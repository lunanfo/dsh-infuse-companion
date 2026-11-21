/**
 * Infuse Companion — Host half.
 *
 * Automatically pauses Infuse playback when an AI session completes its turn,
 * requests tool/plan approval, or asks the user a question.
 *
 * Exposes the same core operations to:
 *  - the left-sidebar panel via `/infuse-companion/api` (fenced by Connection auth)
 *  - the agent tool `infuse_companion`
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

export const name = 'infuse-companion';
export const inject = ['tools'];

const BRIDGE_PATH = '/infuse-companion/api';
const MAX_BODY_BYTES = 1 << 18;
const MAX_HISTORY_ITEMS = 40;
const WIDGET_BRIDGE_PORT = 8899;
/** How long an approval request must stay unanswered before it is treated as needing a human. */
const APPROVAL_GRACE_MS = 800;

const PKG_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELPER_SRC = path.join(PKG_DIR, 'bin', 'infuse-ax.swift');
const HELPER_BIN = path.join(PKG_DIR, 'bin', 'infuse-ax');
const DATA_DIR = path.join(os.homedir(), '.dsh', 'plugin-data', 'infuse-companion');
const LOG_FILE = path.join(DATA_DIR, 'events.jsonl');
const DEBUG_LOG_FILE = path.join(DATA_DIR, 'debug.log');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

/* ----------------------------------------------------------- module state */
/* Kept at module level so config edits that restart the fiber preserve history */

const runtimeState = {
  cachedPid: 0,
  cachedPorts: [],
  lastKnownMedia: null,
  lastAutoPause: null,
  lastTriggerAt: 0,
  history: [],
  stats: {
    autoPausedCount: 0,
    manualActionCount: 0,
    skippedCount: 0,
  },
};

function normalizeConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: src.enabled !== false,
    pauseOnTurnComplete: src.pauseOnTurnComplete !== false,
    pauseOnApprovalNeeded: src.pauseOnApprovalNeeded !== false,
    pauseOnQuestionAsked: src.pauseOnQuestionAsked !== false,
    onlyRootSessions: src.onlyRootSessions !== false,
    // Also pause when a turn ends with an unrecoverable error instead of completed.
    pauseOnTurnError: src.pauseOnTurnError === true,
    // Pause on every intermediate goal round (default: only the final round pauses).
    pauseOnGoalRounds: src.pauseOnGoalRounds === true,
    // How long an approval must stay undecided before it counts as a human wait.
    approvalGraceMs:
      Number.isFinite(src.approvalGraceMs) && src.approvalGraceMs >= 0
        ? Math.min(Math.round(src.approvalGraceMs), 60000)
        : APPROVAL_GRACE_MS,
    cooldownSeconds:
      Number.isFinite(src.cooldownSeconds) && src.cooldownSeconds >= 0
        ? Math.min(Math.round(src.cooldownSeconds), 60)
        : 3,
  };
}

let liveSettings = normalizeConfig({});

/* ------------------------------------------------------------------ utils */

const messageOf = (err) => (err instanceof Error ? err.message : String(err ?? 'unknown error'));
const codeOf = (err) =>
  err && typeof err.code === 'string' && err.code !== 'ERR_INVALID_ARG_TYPE' ? err.code : 'internal';

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatMediaLabel(media) {
  if (!media) return '';
  const series = media.seriesTitle ? String(media.seriesTitle).trim() : '';
  const title = media.title ? String(media.title).trim() : '';
  const s = Number.isInteger(media.season) && media.season > 0 ? media.season : 0;
  const e = Number.isInteger(media.episode) && media.episode > 0 ? media.episode : 0;
  const se = s > 0 || e > 0 ? `S${s}E${e}` : '';
  if (series && se && title) return `${series} ${se} · ${title}`;
  if (series && se) return `${series} ${se}`;
  if (series && title) return `${series} · ${title}`;
  return series || title || '';
}

function pushHistory(entry) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    reason: entry.reason || 'manual-pause',
    outcome: entry.outcome || 'paused',
    sessionId: entry.sessionId || '',
    sessionTitle: entry.sessionTitle || '',
    mediaLabel: entry.mediaLabel || '',
    positionSeconds: Number.isFinite(entry.positionSeconds) ? entry.positionSeconds : null,
    durationSeconds: Number.isFinite(entry.durationSeconds) ? entry.durationSeconds : null,
    detail: entry.detail || '',
  };
  runtimeState.history.unshift(record);
  if (runtimeState.history.length > MAX_HISTORY_ITEMS) {
    runtimeState.history.length = MAX_HISTORY_ITEMS;
  }
  appendEventLog(record);
  return record;
}

/* ------------------------------------------------------- persistent log */

const LOG_MAX_BYTES = 512 * 1024;

/** Rotate one append-only log file to `<file>.1` once it exceeds the cap. */
function rotateLogIfNeeded(filename) {
  try {
    if (fs.statSync(filename).size > LOG_MAX_BYTES) {
      try {
        fs.rmSync(`${filename}.1`, { force: true });
      } catch {
        /* ignore */
      }
      fs.renameSync(filename, `${filename}.1`);
    }
  } catch {
    /* missing file */
  }
}

/** Append one trigger record to the on-disk log (best effort; never throws). */
function appendEventLog(record) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    rotateLogIfNeeded(LOG_FILE);
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(record)}\n`);
  } catch {
    /* logging must never break the plugin */
  }
}

/** Append one diagnostic line; keeps trigger debugging out of the user-facing history. */
function appendDebugLog(entry) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    rotateLogIfNeeded(DEBUG_LOG_FILE);
    fs.appendFileSync(DEBUG_LOG_FILE, `${JSON.stringify({ t: Date.now(), ...entry })}\n`);
  } catch {
    /* best effort */
  }
}

/** Persist the last automatic pause so the panel banner can be restored. */
function persistState() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastAutoPause: runtimeState.lastAutoPause }));
  } catch {
    /* best effort */
  }
}

/** Restore persisted state at start; falls back silently when absent. */
function restoreState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.lastAutoPause) {
      runtimeState.lastAutoPause = parsed.lastAutoPause;
    }
  } catch {
    /* first run */
  }
}

/** Rebuild the in-memory history from the tail of the persisted log. */
function restoreHistory() {
  try {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    const tail = lines.slice(-MAX_HISTORY_ITEMS).reverse();
    runtimeState.history = tail
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    /* no log yet */
  }
}

/** Read the newest persisted records for the `logs` tool action. */
async function readLogTail(limit = 50) {
  try {
    const text = await fs.promises.readFile(LOG_FILE, 'utf8');
    return text
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}

/* ---------------------------------------------------- native helper & HTTP */

let compilePromise = null;

async function ensureHelperBinary() {
  try {
    await fs.promises.access(HELPER_BIN, fs.constants.X_OK);
    return HELPER_BIN;
  } catch {
    if (!compilePromise) {
      compilePromise = execFileAsync('/usr/bin/swiftc', ['-O', HELPER_SRC, '-o', HELPER_BIN], {
        timeout: 30000,
      })
        .then(() => HELPER_BIN)
        .finally(() => {
          compilePromise = null;
        });
    }
    return compilePromise;
  }
}

async function runAxHelper(action = 'inspect') {
  const bin = await ensureHelperBinary();
  const { stdout } = await execFileAsync(bin, [action], { timeout: 4000 });
  return JSON.parse(stdout.trim());
}

async function discoverListeningPorts(pid) {
  if (!pid || pid <= 0) return [];
  try {
    const { stdout } = await execFileAsync(
      '/usr/sbin/lsof',
      ['-nP', '-iTCP', '-sTCP:LISTEN', '-a', '-p', String(pid), '-Fn'],
      { timeout: 2000 },
    );
    const ports = [];
    for (const line of stdout.split('\n')) {
      const m = line.match(/^n.*:(\d+)$/);
      if (m) {
        const p = Number(m[1]);
        if (p > 0 && p < 65536 && !ports.includes(p)) ports.push(p);
      }
    }
    return ports;
  } catch {
    return [];
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeNowPlayingPayload(raw, port, source) {
  if (!raw || typeof raw !== 'object') return null;
  const state = typeof raw.state === 'string' ? raw.state.toLowerCase() : 'idle';
  const item = raw.item && typeof raw.item === 'object' ? raw.item : null;
  const media = item
    ? {
        kind: item.kind || null,
        title: item.title || null,
        seriesTitle: item.seriesTitle || null,
        season: Number.isInteger(item.season) ? item.season : null,
        episode: Number.isInteger(item.episode) ? item.episode : null,
        tmdbID: item.tmdbID || null,
        imdbID: item.imdbID || null,
        tvdbID: item.tvdbID || null,
      }
    : raw.title || raw.seriesTitle
      ? {
          kind: raw.kind || null,
          title: raw.title || null,
          seriesTitle: raw.seriesTitle || null,
          season: Number.isInteger(raw.season) ? raw.season : null,
          episode: Number.isInteger(raw.episode) ? raw.episode : null,
          tmdbID: null,
          imdbID: null,
          tvdbID: null,
        }
      : null;

  const positionSeconds = Number.isFinite(raw.positionSeconds) ? Number(raw.positionSeconds) : null;
  const durationSeconds = Number.isFinite(raw.durationSeconds) ? Number(raw.durationSeconds) : null;
  return {
    state,
    media,
    positionSeconds,
    durationSeconds,
    port,
    source,
  };
}

async function queryInfuseNowPlaying(pid) {
  let candidatePorts = [];
  if (runtimeState.cachedPid === pid && runtimeState.cachedPorts.length > 0) {
    candidatePorts = [...runtimeState.cachedPorts];
  } else {
    candidatePorts = await discoverListeningPorts(pid);
    runtimeState.cachedPid = pid;
    runtimeState.cachedPorts = candidatePorts;
  }

  let directResult = null;
  for (const port of candidatePorts) {
    const data = await fetchJsonWithTimeout(`http://127.0.0.1:${port}/nowplaying`, 750);
    if (data) {
      directResult = normalizeNowPlayingPayload(data, port, 'infuse-direct');
      break;
    }
  }

  // Re-discover ports if cached port failed
  if (!directResult && candidatePorts.length > 0) {
    const freshPorts = await discoverListeningPorts(pid);
    runtimeState.cachedPorts = freshPorts;
    for (const port of freshPorts) {
      if (candidatePorts.includes(port)) continue;
      const data = await fetchJsonWithTimeout(`http://127.0.0.1:${port}/nowplaying`, 750);
      if (data) {
        directResult = normalizeNowPlayingPayload(data, port, 'infuse-direct');
        break;
      }
    }
  }

  if (directResult && directResult.media) {
    runtimeState.lastKnownMedia = {
      ...directResult.media,
      positionSeconds: directResult.positionSeconds,
      durationSeconds: directResult.durationSeconds,
      updatedAt: Date.now(),
    };
  }

  // If Infuse reports "idle" with null item while paused for a while, check InfuseNowPlaying bridge (8899)
  if (!directResult || (!directResult.media && directResult.state === 'idle')) {
    const bridgeData = await fetchJsonWithTimeout(`http://127.0.0.1:${WIDGET_BRIDGE_PORT}/nowplaying`, 500);
    if (bridgeData && bridgeData.source === 'infuse') {
      const bridgeNorm = normalizeNowPlayingPayload(bridgeData, WIDGET_BRIDGE_PORT, 'infuse-bridge');
      if (bridgeNorm) {
        if (!directResult) {
          directResult = bridgeNorm;
        } else if (!directResult.media && bridgeNorm.media) {
          directResult.media = bridgeNorm.media;
          if (directResult.positionSeconds === null) directResult.positionSeconds = bridgeNorm.positionSeconds;
          if (directResult.durationSeconds === null) directResult.durationSeconds = bridgeNorm.durationSeconds;
          if (bridgeNorm.state === 'paused') directResult.state = 'paused';
        }
      }
    }
  }

  return directResult;
}

async function inspectInfuseStatus() {
  const ax = await runAxHelper('inspect');
  if (!ax.running) {
    return {
      running: false,
      pid: null,
      active: false,
      axTrusted: Boolean(ax.axTrusted),
      menuItemFound: false,
      menuItemTitle: '',
      menuItemEnabled: false,
      state: 'offline',
      port: null,
      source: null,
      media: null,
      mediaLabel: '',
      positionSeconds: null,
      durationSeconds: null,
      progressPercent: null,
    };
  }

  const np = await queryInfuseNowPlaying(ax.pid);
  const state = np ? np.state : ax.menuItemEnabled ? 'paused' : 'idle';
  const media =
    np?.media ??
    (state === 'paused' && runtimeState.lastKnownMedia
      ? {
          kind: runtimeState.lastKnownMedia.kind,
          title: runtimeState.lastKnownMedia.title,
          seriesTitle: runtimeState.lastKnownMedia.seriesTitle,
          season: runtimeState.lastKnownMedia.season,
          episode: runtimeState.lastKnownMedia.episode,
          tmdbID: runtimeState.lastKnownMedia.tmdbID,
          imdbID: runtimeState.lastKnownMedia.imdbID,
          tvdbID: runtimeState.lastKnownMedia.tvdbID,
        }
      : null);
  const positionSeconds =
    np?.positionSeconds ??
    (state === 'paused' && runtimeState.lastKnownMedia ? runtimeState.lastKnownMedia.positionSeconds : null);
  const durationSeconds =
    np?.durationSeconds ??
    (state === 'paused' && runtimeState.lastKnownMedia ? runtimeState.lastKnownMedia.durationSeconds : null);

  const progressPercent =
    Number.isFinite(positionSeconds) && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.max(0, Math.min(100, Math.round((positionSeconds / durationSeconds) * 1000) / 10))
      : null;

  return {
    running: true,
    pid: ax.pid,
    active: Boolean(ax.active),
    axTrusted: Boolean(ax.axTrusted),
    menuItemFound: Boolean(ax.menuItemFound),
    menuItemTitle: ax.menuItemTitle || '',
    menuItemEnabled: Boolean(ax.menuItemEnabled),
    state,
    port: np?.port ?? null,
    source: np?.source ?? null,
    media,
    mediaLabel: formatMediaLabel(media),
    positionSeconds,
    durationSeconds,
    progressPercent,
  };
}

function buildFullSnapshot(infuseStatus, extra = {}) {
  return {
    infuse: infuseStatus,
    config: { ...liveSettings },
    lastAutoPause: runtimeState.lastAutoPause,
    history: runtimeState.history.slice(0, 25),
    stats: { ...runtimeState.stats },
    ...extra,
  };
}

/* --------------------------------------------------------- core operations */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function performPause(options = {}) {
  const reason = options.reason || 'manual-pause';
  const sessionId = options.sessionId || '';
  const sessionTitle = options.sessionTitle || '';
  const isAuto = reason !== 'manual-pause';

  const before = await inspectInfuseStatus();
  if (!before.running) {
    if (isAuto) {
      appendDebugLog({ event: 'pause/not-running', reason, sessionId });
      return buildFullSnapshot(before, {
        changed: false,
        outcome: 'skipped-not-playing',
      });
    }
    throw makeError('infuse-not-running', 'Infuse is not currently running');
  }

  // Crucial safety check: only toggle when Infuse is actively playing!
  if (before.state !== 'playing') {
    runtimeState.stats.skippedCount += 1;
    // An automatic trigger that finds nothing playing is routine (e.g. another
    // root session finished while the show was paused). Keep it out of the
    // user-facing history and record it for diagnostics only.
    if (isAuto) {
      appendDebugLog({
        event: 'pause/skip-not-playing',
        reason,
        sessionId,
        mediaLabel: before.mediaLabel,
        positionSeconds: before.positionSeconds,
      });
      return buildFullSnapshot(before, {
        changed: false,
        outcome: 'skipped-not-playing',
      });
    }
    const record = pushHistory({
      reason,
      outcome: 'skipped-not-playing',
      sessionId,
      sessionTitle,
      mediaLabel: before.mediaLabel,
      positionSeconds: before.positionSeconds,
      durationSeconds: before.durationSeconds,
    });
    return buildFullSnapshot(before, {
      changed: false,
      outcome: 'skipped-not-playing',
      record,
    });
  }

  if (!before.axTrusted) {
    throw makeError('ax-not-trusted', 'Accessibility permission is required to control Infuse');
  }
  if (!before.menuItemFound || !before.menuItemEnabled) {
    throw makeError('menu-unavailable', 'Infuse Play/Pause menu item is unavailable');
  }

  const toggleRes = await runAxHelper('toggle');
  if (!toggleRes.pressed) {
    throw makeError('internal', `AXPress failed with code ${toggleRes.pressError}`);
  }

  await sleep(360);
  const after = await inspectInfuseStatus();
  const mediaLabel = before.mediaLabel || after.mediaLabel;
  const positionSeconds = after.positionSeconds ?? before.positionSeconds;
  const durationSeconds = after.durationSeconds ?? before.durationSeconds;

  const record = pushHistory({
    reason,
    outcome: 'paused',
    sessionId,
    sessionTitle,
    mediaLabel,
    positionSeconds,
    durationSeconds,
  });

  if (isAuto) {
    runtimeState.stats.autoPausedCount += 1;
    runtimeState.lastAutoPause = record;
    persistState();
  } else {
    runtimeState.stats.manualActionCount += 1;
  }

  return buildFullSnapshot(after, {
    changed: true,
    outcome: 'paused',
    record,
  });
}

async function performResume(options = {}) {
  const reason = options.reason || 'manual-resume';
  const before = await inspectInfuseStatus();
  if (!before.running) {
    throw makeError('infuse-not-running', 'Infuse is not currently running');
  }

  if (before.state === 'playing') {
    runtimeState.stats.skippedCount += 1;
    const record = pushHistory({
      reason,
      outcome: 'skipped-already-playing',
      mediaLabel: before.mediaLabel,
      positionSeconds: before.positionSeconds,
      durationSeconds: before.durationSeconds,
    });
    return buildFullSnapshot(before, {
      changed: false,
      outcome: 'skipped-already-playing',
      record,
    });
  }

  if (!before.axTrusted) {
    throw makeError('ax-not-trusted', 'Accessibility permission is required to control Infuse');
  }
  if (!before.menuItemFound || !before.menuItemEnabled) {
    throw makeError('menu-unavailable', 'Infuse Play/Pause menu item is unavailable');
  }

  const toggleRes = await runAxHelper('toggle');
  if (!toggleRes.pressed) {
    throw makeError('internal', `AXPress failed with code ${toggleRes.pressError}`);
  }

  await sleep(360);
  const after = await inspectInfuseStatus();
  runtimeState.stats.manualActionCount += 1;
  runtimeState.lastAutoPause = null;
  persistState();

  const record = pushHistory({
    reason,
    outcome: 'resumed',
    mediaLabel: after.mediaLabel || before.mediaLabel,
    positionSeconds: after.positionSeconds ?? before.positionSeconds,
    durationSeconds: after.durationSeconds ?? before.durationSeconds,
  });

  return buildFullSnapshot(after, {
    changed: true,
    outcome: 'resumed',
    record,
  });
}

async function performToggle() {
  const before = await inspectInfuseStatus();
  if (!before.running) {
    throw makeError('infuse-not-running', 'Infuse is not currently running');
  }
  if (!before.axTrusted) {
    throw makeError('ax-not-trusted', 'Accessibility permission is required to control Infuse');
  }
  if (!before.menuItemFound || !before.menuItemEnabled) {
    throw makeError('menu-unavailable', 'Infuse Play/Pause menu item is unavailable');
  }

  const toggleRes = await runAxHelper('toggle');
  if (!toggleRes.pressed) {
    throw makeError('internal', `AXPress failed with code ${toggleRes.pressError}`);
  }

  await sleep(360);
  const after = await inspectInfuseStatus();
  runtimeState.stats.manualActionCount += 1;
  if (after.state === 'playing') {
    runtimeState.lastAutoPause = null;
  }

  const outcome = after.state === 'playing' ? 'resumed' : after.state === 'paused' ? 'paused' : 'toggled';
  const record = pushHistory({
    reason: 'manual-toggle',
    outcome,
    mediaLabel: after.mediaLabel || before.mediaLabel,
    positionSeconds: after.positionSeconds ?? before.positionSeconds,
    durationSeconds: after.durationSeconds ?? before.durationSeconds,
  });

  return buildFullSnapshot(after, {
    changed: true,
    outcome,
    record,
  });
}

async function performConfigure(ctx, patch) {
  const next = normalizeConfig({
    ...liveSettings,
    ...(patch && typeof patch === 'object' ? patch : {}),
  });
  liveSettings = next;

  let persisted = false;
  const entry = ctx?.fiber?.entry;
  const editor = ctx?.get?.('configEditor');
  if (entry !== undefined && editor && typeof editor.edit === 'function') {
    try {
      await editor.edit(entry, (current) => ({
        ...(current && typeof current === 'object' ? current : {}),
        ...next,
      }));
      persisted = true;
    } catch {
      persisted = false;
    }
  }

  const infuse = await inspectInfuseStatus();
  return buildFullSnapshot(infuse, { persisted });
}

/* ----------------------------------------------------- auto-pause pipeline */

function getSessionTitle(ctx, session) {
  if (!session) return '';
  try {
    const titleSvc = ctx.get('sessionTitle');
    const snap = titleSvc?.get?.(session);
    if (snap && typeof snap.title === 'string' && snap.title.trim()) {
      return snap.title.trim();
    }
  } catch {
    /* ignore */
  }
  return session.id || '';
}

function isRootAgentOrSession(ctx, agent, session) {
  try {
    const agents = ctx.get('agents');
    if (agent && agents && typeof agents.roots === 'function') {
      return agents.roots().includes(agent);
    }
    if (session && agents && typeof agents.get === 'function' && typeof agents.roots === 'function') {
      const found = agents.get(session.id);
      if (found) return agents.roots().includes(found);
    }
  } catch {
    /* ignore */
  }
  if (session?.header?.parentSession) return false;
  return true;
}

/**
 * Whether this agent's session is inside an armed, still-running goal. Such an
 * intermediate turn end is followed automatically by the next goal round, so it
 * is not a "come review this" moment for the user.
 */
function isGoalContinuing(ctx, agent) {
  try {
    const goals = ctx.get('goals');
    const view = typeof goals?.get === 'function' ? goals.get(agent) : undefined;
    if (!view) return false;
    return (
      view.phase === 'active' &&
      view.activation === 'armed' &&
      Number.isFinite(view.roundsStarted) &&
      Number.isFinite(view.maxGoalRounds) &&
      view.roundsStarted < view.maxGoalRounds
    );
  } catch {
    return false;
  }
}

async function handleAutoTrigger(ctx, { reason, sessionId, sessionTitle, bypassCooldown = false }) {
  const now = Date.now();
  const cooldownMs = (liveSettings.cooldownSeconds ?? 3) * 1000;
  if (!bypassCooldown && cooldownMs > 0 && now - runtimeState.lastTriggerAt < cooldownMs) {
    appendDebugLog({ event: 'trigger/cooldown-skip', reason, sessionId });
    return null;
  }
  runtimeState.lastTriggerAt = now;

  try {
    const result = await performPause({
      reason,
      sessionId,
      sessionTitle,
    });
    if (result.changed) {
      ctx?.logger?.info?.(
        `infuse-companion: auto-paused Infuse (${reason}) for session "${sessionTitle || sessionId}"`,
      );
    }
    return result;
  } catch (err) {
    ctx?.logger?.warn?.(`infuse-companion: auto-pause failed (${reason}): ${messageOf(err)}`);
    appendDebugLog({ event: 'trigger/error', reason, sessionId, error: messageOf(err) });
    return null;
  }
}

/* ------------------------------------------------------- shared dispatcher */

async function executeOperation(ctx, op, args = {}) {
  switch (op) {
    case 'status': {
      const infuse = await inspectInfuseStatus();
      return buildFullSnapshot(infuse);
    }
    case 'pause':
      return performPause({
        reason: args.reason || 'manual-pause',
        sessionId: args.sessionId || '',
        sessionTitle: args.sessionTitle || '',
      });
    case 'resume':
      return performResume({ reason: 'manual-resume' });
    case 'toggle':
      return performToggle();
    case 'configure':
      return performConfigure(ctx, args.config || args);
    case 'simulate_trigger': {
      const res = await handleAutoTrigger(ctx, {
        reason: 'test-trigger',
        sessionId: args.sessionId || 'simulated-session',
        sessionTitle: args.sessionTitle || 'AI 会话完成模拟测试',
        bypassCooldown: true,
      });
      if (res) return res;
      const infuse = await inspectInfuseStatus();
      return buildFullSnapshot(infuse, { changed: false, outcome: 'failed' });
    }
    case 'clear_history': {
      runtimeState.history = [];
      runtimeState.lastAutoPause = null;
      // Also truncate the persisted log, otherwise a restart would restore the
      // entries the user just cleared.
      try {
        fs.writeFileSync(LOG_FILE, '');
      } catch {
        /* best effort */
      }
      persistState();
      const infuse = await inspectInfuseStatus();
      return buildFullSnapshot(infuse);
    }
    case 'logs': {
      const infuse = await inspectInfuseStatus();
      const logs = await readLogTail(Number.isInteger(args.limit) ? args.limit : 50);
      return buildFullSnapshot(infuse, { logs, logFile: LOG_FILE });
    }
    default:
      throw makeError('bad-request', `Unknown operation: ${String(op || '(empty)')}`);
  }
}

/* -------------------------------------------------------------- agent tool */

function formatToolSummary(op, data) {
  const inf = data.infuse || {};
  const lines = [];
  const stateLabel =
    inf.state === 'playing'
      ? 'PLAYING (正在播放)'
      : inf.state === 'paused'
        ? 'PAUSED (已暂停)'
        : inf.state === 'idle'
          ? 'IDLE (空闲)'
          : 'OFFLINE (未运行)';

  lines.push(`Infuse status: ${stateLabel}${inf.pid ? ` (PID ${inf.pid})` : ''}`);
  if (inf.mediaLabel) {
    const pos = inf.positionSeconds !== null ? formatClock(inf.positionSeconds) : '?';
    const dur = inf.durationSeconds !== null ? formatClock(inf.durationSeconds) : '?';
    const pct = inf.progressPercent !== null ? ` (${inf.progressPercent}%)` : '';
    lines.push(`Now playing: ${inf.mediaLabel} — ${pos} / ${dur}${pct}`);
  }
  if (data.outcome) {
    lines.push(`Operation (${op}) outcome: ${data.outcome} (changed: ${Boolean(data.changed)})`);
  }
  const cfg = data.config || {};
  lines.push(
    `Auto-pause rules: enabled=${cfg.enabled}, turnComplete=${cfg.pauseOnTurnComplete}, approvalNeeded=${cfg.pauseOnApprovalNeeded}, questionAsked=${cfg.pauseOnQuestionAsked}, onlyRootSessions=${cfg.onlyRootSessions}, pauseOnTurnError=${cfg.pauseOnTurnError}, pauseOnGoalRounds=${cfg.pauseOnGoalRounds}, approvalGraceMs=${cfg.approvalGraceMs}`,
  );
  const history = op === 'logs' ? [] : Array.isArray(data.history) ? data.history.slice(0, 6) : [];
  if (history.length > 0) {
    lines.push('Recent triggers (newest first):');
    for (const item of history) {
      const when = new Date(item.timestamp).toLocaleString();
      const session = item.sessionTitle ? ` · ${item.sessionTitle}` : '';
      const media = item.mediaLabel ? ` · ${item.mediaLabel}` : '';
      lines.push(`  - ${when} ${item.reason} → ${item.outcome}${session}${media}`);
    }
  }
  const logs = Array.isArray(data.logs) ? data.logs.slice(0, 10) : [];
  if (op === 'logs') {
    lines.push(`Log file: ${data.logFile || LOG_FILE}`);
    if (logs.length === 0) lines.push('(no persisted trigger records yet)');
  }
  if (logs.length > 0) {
    lines.push(`Persisted log (${data.logFile || ''}), newest first:`);
    for (const item of logs) {
      const when = new Date(item.timestamp).toLocaleString();
      lines.push(
        `  - ${when} ${item.reason} → ${item.outcome}${item.sessionTitle ? ` · ${item.sessionTitle}` : ''}`,
      );
    }
  }
  return lines.join('\n');
}

function registerTools(ctx) {
  return ctx.tools.register({
    name: 'infuse_companion',
    description:
      'Inspect or control Infuse video playback and configure automatic pause rules when an AI session completes or needs user attention.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'status',
            'pause',
            'resume',
            'toggle',
            'configure',
            'simulate_trigger',
            'clear_history',
            'logs',
          ],
          description:
            'Operation to run: status (inspect playback & rules), logs (recent trigger records), pause (safely pause only if playing), resume (safely resume only if paused), toggle, configure (update auto-pause rules), simulate_trigger, or clear_history.',
        },
        enabled: {
          type: 'boolean',
          description: 'For action=configure: enable or disable automatic Infuse pause.',
        },
        pauseOnTurnComplete: {
          type: 'boolean',
          description: 'For action=configure: pause Infuse when an AI session turn finishes.',
        },
        pauseOnApprovalNeeded: {
          type: 'boolean',
          description: 'For action=configure: pause Infuse when tool or plan approval is requested.',
        },
        pauseOnQuestionAsked: {
          type: 'boolean',
          description: 'For action=configure: pause Infuse when ask_user_question is called.',
        },
        onlyRootSessions: {
          type: 'boolean',
          description: 'For action=configure: ignore background subagent turns and only trigger on root sessions.',
        },
        pauseOnTurnError: {
          type: 'boolean',
          description: 'For action=configure: also pause when a turn stops with an unrecoverable error.',
        },
        pauseOnGoalRounds: {
          type: 'boolean',
          description:
            'For action=configure: also pause on every intermediate goal round; off by default so only the final round pauses.',
        },
        approvalGraceMs: {
          type: 'integer',
          minimum: 0,
          maximum: 60000,
          description:
            'For action=configure: how long (ms) an approval must stay undecided before it counts as a human wait. Default 800.',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {},
      render: (_args, value) => [{ type: 'text', text: value.summary }],
    },
    timeoutMs: 15000,
    async execute(args) {
      const action = args.action || 'status';
      const patch = {};
      for (const k of [
        'enabled',
        'pauseOnTurnComplete',
        'pauseOnApprovalNeeded',
        'pauseOnQuestionAsked',
        'onlyRootSessions',
        'pauseOnTurnError',
        'pauseOnGoalRounds',
      ]) {
        if (typeof args[k] === 'boolean') patch[k] = args[k];
      }
      if (Number.isFinite(args.approvalGraceMs)) patch.approvalGraceMs = args.approvalGraceMs;
      const data = await executeOperation(ctx, action, patch);
      return {
        summary: formatToolSummary(action, data),
        data,
      };
    },
  });
}

/* -------------------------------------------------------------- web bridge */

const STATUS_BY_CODE = {
  'bad-request': 400,
  'unauthorized': 401,
  'ax-not-trusted': 422,
  'infuse-not-running': 422,
  'menu-unavailable': 422,
  'too-large': 413,
};

const baseType = (req) => String(req.headers?.['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  res.end(text);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw makeError('too-large', 'request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function rejectionOf(web, req) {
  const connection = web.connection;
  const normalize = (r) => {
    if (r === undefined || r === null || r === false) return undefined;
    if (typeof r === 'number') return r;
    if (typeof r.status === 'number') return r.status;
    return 403;
  };
  try {
    if (connection && typeof connection.requestRejection === 'function') {
      return normalize(connection.requestRejection(req));
    }
    if (connection && typeof connection.admit === 'function') {
      const adm = connection.admit(req);
      if (adm && adm.admitted === false) return 403;
      return undefined;
    }
  } catch {
    return 403;
  }
  return 403;
}

function createBridgeHandler(ctx) {
  return async function handleBridge(web, req, res) {
    const rejection = rejectionOf(web, req);
    if (rejection !== undefined) {
      return sendJson(res, rejection, {
        ok: false,
        error: { code: 'unauthorized', message: 'dsh web authentication required' },
      });
    }
    if (req.method !== 'POST') {
      return sendJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } });
    }
    if (baseType(req) !== 'application/json') {
      return sendJson(res, 415, {
        ok: false,
        error: { code: 'content-type', message: 'application/json only' },
      });
    }

    let body;
    try {
      body = JSON.parse(await readBody(req, MAX_BODY_BYTES));
    } catch (err) {
      const code = codeOf(err) === 'too-large' ? 'too-large' : 'bad-request';
      return sendJson(res, STATUS_BY_CODE[code] ?? 400, {
        ok: false,
        error: { code, message: messageOf(err) },
      });
    }

    const op = body && typeof body.op === 'string' ? body.op : 'status';
    const args = body && body.args && typeof body.args === 'object' ? body.args : {};

    try {
      const data = await executeOperation(ctx, op, args);
      return sendJson(res, 200, { ok: true, data });
    } catch (err) {
      const code = codeOf(err);
      return sendJson(res, STATUS_BY_CODE[code] ?? 500, {
        ok: false,
        error: { code, message: messageOf(err) },
      });
    }
  };
}

/* ------------------------------------------------------------ plugin entry */

export function apply(ctx, config) {
  liveSettings = normalizeConfig(config);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* best effort */
  }
  restoreState();
  restoreHistory();
  try {
    ctx.logger?.info?.(
      `infuse-companion: started (log=${LOG_FILE})`,
    );
  } catch {
    /* logging is best effort */
  }

  ctx.effect(() => registerTools(ctx), 'infuse-companion: agent tool');

  const pendingTimers = new Set();
  const approvalTimers = new Map();
  ctx.effect(() => () => {
    for (const timer of pendingTimers) clearTimeout(timer);
    pendingTimers.clear();
    for (const timer of approvalTimers.values()) clearTimeout(timer);
    approvalTimers.clear();
  }, 'infuse-companion: pending timers');

  // 1. Durable session events drive every trigger. Using the event feed (rather
  // than scoped waterfall listeners) keeps questions and approvals observable no
  // matter which context dispatched them.
  const scheduleAttention = (ctx, reason, session, delayMs) => {
    const sessionId = session?.id;
    if (!sessionId) return;
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      try {
        const agents = ctx.get('agents');
        const agent = agents?.get?.(sessionId);
        if (liveSettings.onlyRootSessions && !isRootAgentOrSession(ctx, agent, session)) {
          appendDebugLog({ event: 'attention/root-skip', reason, sessionId });
          return;
        }
        void handleAutoTrigger(ctx, {
          reason,
          sessionId,
          sessionTitle: getSessionTitle(ctx, session),
        });
      } catch (err) {
        appendDebugLog({ event: 'attention/schedule-error', reason, sessionId, error: messageOf(err) });
      }
    }, delayMs);
    pendingTimers.add(timer);
    appendDebugLog({ event: 'attention/scheduled', reason, sessionId, delayMs });
  };

  ctx.on(
    'session/event',
    (session, event) => {
      try {
        if (!event) return;
        const sessionId = session?.id;

        if (event.type === 'turn/end') {
          if (!liveSettings.enabled) return;
          const reasonKind = event.data?.reason?.kind;
          // A completed turn always waits for review. An errored turn only stops
          // the agent too, so it can opt in; aborted/max-tokens never pause.
          const isError = reasonKind === 'error';
          if (reasonKind !== 'completed' && !(isError && liveSettings.pauseOnTurnError)) return;
          const reason = isError ? 'turn-error' : 'turn-complete';
          if (!isError && !liveSettings.pauseOnTurnComplete) return;
          const timer = setTimeout(() => {
            pendingTimers.delete(timer);
            try {
              if (!liveSettings.enabled) return;
              if (reason === 'turn-error' ? !liveSettings.pauseOnTurnError : !liveSettings.pauseOnTurnComplete) return;
              const agents = ctx.get('agents');
              const agent = agents?.get?.(sessionId);
              if (liveSettings.onlyRootSessions && !isRootAgentOrSession(ctx, agent, session)) {
                return;
              }
              // A goal round that will continue automatically is not the moment to ask
              // the user to look; wait for the final round (complete/blocked/cap/disarmed).
              if (!liveSettings.pauseOnGoalRounds && agent && isGoalContinuing(ctx, agent)) {
                appendDebugLog({ event: 'turn/goal-continuing-skip', sessionId });
                return;
              }
              // If another turn or step is already queued/running, wait until it actually settles
              if (agent) {
                const nextTurnLen = agent.inbox?.nextTurn?.length ?? 0;
                const nextStepLen = agent.inbox?.nextStep?.length ?? 0;
                if (nextTurnLen > 0 || nextStepLen > 0) return;
              }
              void handleAutoTrigger(ctx, {
                reason,
                sessionId,
                sessionTitle: getSessionTitle(ctx, session),
              });
            } catch {
              /* ignore */
            }
          }, 180);
          pendingTimers.add(timer);
          return;
        }

        // A question or plan review is about to block on the user.
        if (event.type === 'tool/call') {
          const name = event.data?.name;
          if (name === 'ask_user_question') {
            if (!liveSettings.enabled || !liveSettings.pauseOnQuestionAsked) return;
            appendDebugLog({ event: 'question/observed', sessionId, name });
            scheduleAttention(ctx, 'question-asked', session, 150);
          } else if (name === 'exit_plan_mode') {
            if (!liveSettings.enabled || !liveSettings.pauseOnApprovalNeeded) return;
            appendDebugLog({ event: 'plan-review/observed', sessionId });
            scheduleAttention(ctx, 'approval-needed', session, 150);
          }
          return;
        }

        // Approvals: pause only when the request is still undecided after a short
        // grace period, so auto-approved/fail-closed requests never interrupt.
        if (event.type === 'approval/asked') {
          const id = event.data?.id;
          if (!id) return;
          if (!liveSettings.enabled || !liveSettings.pauseOnApprovalNeeded) return;
          const graceMs = liveSettings.approvalGraceMs;
          const timer = setTimeout(() => {
            approvalTimers.delete(id);
            appendDebugLog({ event: 'approval/pause', id, tool: event.data?.toolName ?? '' });
            scheduleAttention(ctx, 'approval-needed', session, 0);
          }, graceMs);
          approvalTimers.set(id, timer);
          appendDebugLog({
            event: 'approval/observed',
            id,
            tool: event.data?.toolName ?? '',
            sessionId,
            graceMs,
          });
          return;
        }

        if (event.type === 'approval/decided') {
          const id = event.data?.id;
          const timer = approvalTimers.get(id);
          if (timer !== undefined) {
            clearTimeout(timer);
            approvalTimers.delete(id);
            appendDebugLog({ event: 'approval/settled-before-grace', id });
          }
        }
      } catch (err) {
        appendDebugLog({ event: 'session-event/error', error: messageOf(err) });
      }
    },
    { global: true },
  );

  // 4. Register authenticated Web route for the left-sidebar UI panel
  ctx.inject(['webServer', 'connection'], (web) => {
    const handle = createBridgeHandler(ctx);
    const route = {
      kind: 'exact',
      path: BRIDGE_PATH,
      handler: (req, res) => handle(web, req, res),
    };
    web.effect(() => web.webServer.register(route), `infuse-companion: ${BRIDGE_PATH} route`);
  });
}
