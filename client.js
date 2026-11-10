/**
 * Infuse Companion — Client half.
 *
 * Registers:
 *   1. Left sidebar panel entry (`sidebar.panellist`, id `infuse-companion`)
 *   2. Main panel view (`main`, key `infuse-companion`)
 *
 * Uses only `react` from the platform module table and `--dsw-alias-*` theme tokens.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-infuse-companion',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    const NS = 'infuseCompanion';
    const PANEL_ID = 'infuse-companion';
    const BRIDGE_URL = 'infuse-companion/api';
    const INFUSE_MARK_PATH =
      'M18.802 7.736c0 .502-.035.8-.146 1.24a5.1 5.1 0 0 1-.968 1.932c-.176.218-.574.61-.778.764c-.077.06-2.619 1.894-5.65 4.077a842 842 0 0 0-5.638 4.077a2.6 2.6 0 0 0-.55.715a2.39 2.39 0 0 0 1.003 3.18c.703.379 1.622.372 2.293-.02a2322 2322 0 0 0 11.378-8.184a6 6 0 0 0 .845-.849a4.78 4.78 0 0 0 .76-4.416a4.86 4.86 0 0 0-1.354-2.068a15 15 0 0 0-.673-.518c-.257-.185-.48-.35-.497-.361c-.02-.017-.025.089-.025.43M4.31 5.62c-.903.2-1.573.844-1.822 1.75l-.066.234v7.712l.064.227c.302 1.093 1.212 1.8 2.316 1.8c1.158 0 2.12-.794 2.349-1.945c.044-.223.044-7.654 0-7.877a2.5 2.5 0 0 0-.23-.656A2.38 2.38 0 0 0 5.393 5.64a3 3 0 0 0-1.083-.02M6.642.03a4.79 4.79 0 0 0-4.126 3.777c-.054.263-.124.912-.1.936a1 1 0 0 0 .208-.12a4.2 4.2 0 0 1 1.393-.572c.335-.073 1.005-.09 1.366-.037c.596.089 1.104.295 1.705.698c.103.07 1.913 1.376 4.02 2.902c2.107 1.529 3.884 2.804 3.95 2.837c.098.049.15.058.328.058c.185 0 .228-.009.352-.068c.187-.091.654-.555.834-.834c.882-1.341.71-3.078-.41-4.185c-.143-.143-.938-.726-3.273-2.417C11.196 1.779 9.706.716 9.584.645A4.8 4.8 0 0 0 6.642.03';

    const zh = {
      'meta.title': 'Infuse 看剧伴侣',
      'meta.description': '在 AI 会话完成、请求工具审批或向您提问时自动暂停 Infuse 播放，并在左侧栏提供实时播放状态与自动暂停控制面板。',
      'panel.label': 'Infuse 伴侣',
      'page.title': 'Infuse 看剧伴侣',
      'page.subtitle': '看剧与使用 DSH 两不误：当 AI 会话完成、需要审批或向您提问时，自动在后台无感暂停 Infuse 播放。',
      'status.refresh': '刷新状态',
      'status.refreshing': '刷新中…',
      'status.playing': '正在播放',
      'status.paused': '已暂停',
      'status.idle': '空闲 / 未播放',
      'status.offline': 'Infuse 未运行',
      'status.axReady': '辅助功能控制就绪',
      'status.axMissing': '需要辅助功能权限',
      'status.menuReady': '菜单项「播放/暂停」可用',
      'status.menuDisabled': '当前无活跃视频菜单',
      'nowPlaying.sectionTitle': '当前 Infuse 播放状态',
      'nowPlaying.noMedia': '当前没有正在播放或挂起的剧集/电影',
      'nowPlaying.noMediaHint': '在 Infuse 中打开视频后，这里会实时显示剧集名称、播放进度与状态。',
      'nowPlaying.progress': '播放进度',
      'nowPlaying.endpoint': '本地状态端口',
      'nowPlaying.pid': '进程 PID',
      'actions.pause': '暂停播放',
      'actions.resume': '恢复播放',
      'actions.toggle': '切换播放/暂停',
      'actions.simTrigger': '模拟 AI 完成暂停测试',
      'banner.autoPausedTitle': '已为您自动暂停 Infuse 播放',
      'banner.session': '触发会话',
      'banner.reason': '触发原因',
      'banner.media': '暂停位置',
      'banner.resumeNow': '看完了，恢复播放',
      'rules.sectionTitle': '自动暂停规则',
      'rules.sectionDesc': '仅当检测到 Infuse 处于「正在播放」状态时才会执行暂停，绝不会误触把已暂停的视频重新播放。',
      'rules.enabled.title': '启用自动暂停总开关',
      'rules.enabled.desc': '开启后，当 DSH 需要您查看或操作时自动暂停 Infuse。',
      'rules.turnComplete.title': 'AI 会话回合完成时暂停',
      'rules.turnComplete.desc': '当 AI 完成本轮回复、停下来等待您查看结果时自动暂停。',
      'rules.approvalNeeded.title': '需要工具或权限审批时暂停',
      'rules.approvalNeeded.desc': '当 AI 请求执行命令、修改文件或计划审批需要您确认时立即暂停。',
      'rules.questionAsked.title': 'AI 向您提问时暂停',
      'rules.questionAsked.desc': '当 AI 调用提问工具需要您选择或输入回答时立即暂停。',
      'rules.onlyRoot.title': '仅监听主会话（忽略后台子代理）',
      'rules.onlyRoot.desc': '避免子代理在后台完成中间任务时提前打断您看剧，仅在主会话完成或提问时暂停。',
      'rules.saved': '配置已保存并立即生效',
      'rules.memoryOnly': '配置已在当前运行会话生效',
      'history.sectionTitle': '触发与控制记录',
      'history.clear': '清空记录',
      'history.empty': '暂无触发记录。当 AI 会话完成、提问或您手动控制播放时，记录会显示在这里。',
      'reason.turn-complete': 'AI 会话回合已完成',
      'reason.approval-needed': 'AI 请求工具/权限审批',
      'reason.question-asked': 'AI 向您发起了提问',
      'reason.manual-pause': '手动暂停播放',
      'reason.manual-resume': '手动恢复播放',
      'reason.manual-toggle': '手动切换播放/暂停',
      'reason.test-trigger': '模拟自动暂停测试',
      'outcome.paused': '已自动暂停',
      'outcome.resumed': '已恢复播放',
      'outcome.toggled': '已切换状态',
      'outcome.skipped-not-playing': '已暂停/未播放，跳过操作',
      'outcome.skipped-already-playing': '已在播放中，跳过操作',
      'outcome.skipped-disabled': '自动暂停已关闭',
      'outcome.skipped-cooldown': '冷却时间内，跳过重复触发',
      'outcome.failed': '控制执行失败',
      'error.unauthorized': 'DSH Web 鉴权已过期，请刷新页面后重试。',
      'error.route-missing': '插件后端接口尚未就绪，请检查插件是否已启用。',
      'error.network': '无法连接插件后端接口，请稍后重试。',
      'error.infuse-not-running': '未检测到正在运行的 Infuse 应用。',
      'error.ax-not-trusted': '当前未授予辅助功能（Accessibility）权限，无法触发菜单暂停。',
      'error.menu-unavailable': 'Infuse 的「播放/暂停」菜单项当前不可用，请确认已打开视频。',
      'error.internal': '操作执行失败',
    };

    const en = {
      'meta.title': 'Infuse companion',
      'meta.description': 'Automatically pauses Infuse playback when an AI session completes or needs your review, with a left-sidebar playback and rule panel.',
      'panel.label': 'Infuse companion',
      'page.title': 'Infuse companion',
      'page.subtitle': 'Watch shows in Infuse while working in DSH: automatically pauses Infuse in the background when an AI session finishes, asks for approval, or asks a question.',
      'status.refresh': 'Refresh',
      'status.refreshing': 'Refreshing…',
      'status.playing': 'Playing',
      'status.paused': 'Paused',
      'status.idle': 'Idle / No video',
      'status.offline': 'Infuse not running',
      'status.axReady': 'Accessibility ready',
      'status.axMissing': 'Accessibility permission needed',
      'status.menuReady': 'Play/Pause menu ready',
      'status.menuDisabled': 'No active video menu',
      'nowPlaying.sectionTitle': 'Current Infuse playback',
      'nowPlaying.noMedia': 'No episode or movie currently active',
      'nowPlaying.noMediaHint': 'Start playing a video in Infuse to see the live title, playback progress, and controls here.',
      'nowPlaying.progress': 'Playback progress',
      'nowPlaying.endpoint': 'Local status port',
      'nowPlaying.pid': 'Process PID',
      'actions.pause': 'Pause playback',
      'actions.resume': 'Resume playback',
      'actions.toggle': 'Toggle play/pause',
      'actions.simTrigger': 'Simulate AI completion pause',
      'banner.autoPausedTitle': 'Infuse was paused for your review',
      'banner.session': 'Session',
      'banner.reason': 'Reason',
      'banner.media': 'Paused at',
      'banner.resumeNow': 'Done reviewing, resume playback',
      'rules.sectionTitle': 'Auto-pause rules',
      'rules.sectionDesc': 'Only pauses Infuse when its live state is Playing, so it never accidentally unpauses an already paused video.',
      'rules.enabled.title': 'Enable auto-pause',
      'rules.enabled.desc': 'Automatically pause Infuse whenever DSH needs your attention.',
      'rules.turnComplete.title': 'Pause when AI turn completes',
      'rules.turnComplete.desc': 'Pause Infuse when the AI finishes its reply and is ready for you to check.',
      'rules.approvalNeeded.title': 'Pause when approval is required',
      'rules.approvalNeeded.desc': 'Pause Infuse immediately when the AI requests tool, file, or plan approval.',
      'rules.questionAsked.title': 'Pause when AI asks a question',
      'rules.questionAsked.desc': 'Pause Infuse immediately when the AI calls ask_user_question and waits for your answer.',
      'rules.onlyRoot.title': 'Main sessions only (ignore subagents)',
      'rules.onlyRoot.desc': 'Ignore background subagent completions and only pause when a top-level session finishes or asks.',
      'rules.saved': 'Settings saved and applied',
      'rules.memoryOnly': 'Settings applied for this session',
      'history.sectionTitle': 'Activity log',
      'history.clear': 'Clear log',
      'history.empty': 'No activity yet. Auto-pause events and manual playback actions will appear here.',
      'reason.turn-complete': 'AI turn completed',
      'reason.approval-needed': 'Tool or plan approval needed',
      'reason.question-asked': 'AI asked you a question',
      'reason.manual-pause': 'Manual pause',
      'reason.manual-resume': 'Manual resume',
      'reason.manual-toggle': 'Manual toggle play/pause',
      'reason.test-trigger': 'Simulated auto-pause test',
      'outcome.paused': 'Paused Infuse',
      'outcome.resumed': 'Resumed Infuse',
      'outcome.toggled': 'Toggled playback',
      'outcome.skipped-not-playing': 'Already paused/idle (skipped)',
      'outcome.skipped-already-playing': 'Already playing (skipped)',
      'outcome.skipped-disabled': 'Auto-pause disabled',
      'outcome.skipped-cooldown': 'Skipped (cooldown)',
      'outcome.failed': 'Action failed',
      'error.unauthorized': 'DSH web authentication expired; please reload the page.',
      'error.route-missing': 'Plugin backend route is not active; check if the plugin is enabled.',
      'error.network': 'Cannot reach plugin backend route; please try again.',
      'error.infuse-not-running': 'Infuse is not currently running.',
      'error.ax-not-trusted': 'Accessibility permission is required to trigger Infuse\'s Play/Pause menu item.',
      'error.menu-unavailable': 'Infuse\'s Play/Pause menu item is currently unavailable; make sure a video is open.',
      'error.internal': 'Operation failed',
    };

    class BridgeError extends Error {
      constructor(code, detail) {
        super(code + (detail ? ': ' + detail : ''));
        this.name = 'BridgeError';
        this.code = code;
        this.detail = detail || '';
      }
    }

    async function callHost(op, args, signal) {
      let res;
      try {
        res = await fetch(BRIDGE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op, args: args || {} }),
          credentials: 'same-origin',
          signal,
        });
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        throw new BridgeError('network', err && err.message ? err.message : '');
      }

      const text = await res.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (parsed && parsed.ok === false && parsed.error && parsed.error.code) {
        throw new BridgeError(parsed.error.code, parsed.error.message || '');
      }
      if (res.status === 401 || res.status === 403) {
        throw new BridgeError('unauthorized', '');
      }
      if (res.status === 405) {
        throw new BridgeError('route-missing', '');
      }
      if (!res.ok || !parsed || parsed.ok !== true) {
        throw new BridgeError('internal', `HTTP ${res.status}`);
      }
      return parsed.data;
    }

    function formatClock(sec) {
      if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) return '0:00';
      const total = Math.floor(sec);
      const hrs = Math.floor(total / 3600);
      const mins = Math.floor((total % 3600) / 60);
      const secs = total % 60;
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
    }

    function formatTimeOfDay(ts) {
      if (!ts) return '';
      try {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch {
        return '';
      }
    }

    const STYLES = `
      .infc-root {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        background: var(--dsw-alias-bg-base);
        color: var(--dsw-alias-label-primary);
        padding: 28px 32px 48px;
      }
      /* Clear the macOS traffic lights when the shell overlays the title bar. */
      [data-platform="darwin"] .infc-root {
        padding-top: calc(var(--dsh-frame-top-clearance, 0px) + 20px);
      }
      [data-windows-titlebar] .infc-root {
        padding-top: calc(var(--dsh-frame-chrome-top, 0px) + 20px);
      }
      .infc-container {
        max-width: 780px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .infc-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .infc-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        line-height: 1.3;
        color: var(--dsw-alias-label-primary);
        max-width: 100%;
        overflow-wrap: anywhere;
      }
      .infc-subtitle {
        max-width: 100%;
        overflow-wrap: anywhere;
      }
      @media (max-width: 760px) {
        .infc-root {
          padding-left: 20px;
          padding-right: 20px;
          padding-bottom: 32px;
        }
        .infc-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }
        .infc-title {
          font-size: 18px;
        }
      }
      .infc-subtitle {
        margin: 6px 0 0;
        font-size: 13px;
        line-height: 1.5;
        color: var(--dsw-alias-label-secondary);
      }
      .infc-card {
        background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2));
        border: 1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
        border-radius: var(--dsw-radius-sm, 8px);
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .infc-banner {
        background: var(--dsw-alias-bg-multi-select, var(--dsw-alias-bg-layer-2));
        border: 1px solid var(--dsw-alias-brand-primary, var(--dsw-alias-border-l3));
        border-radius: var(--dsw-radius-sm, 8px);
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .infc-banner-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary);
        margin-bottom: 4px;
      }
      .infc-banner-meta {
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .infc-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .infc-section-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary);
      }
      .infc-section-desc {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
      }
      .infc-badges {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .infc-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        border: 1px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-layer-2);
        color: var(--dsw-alias-label-secondary);
      }
      .infc-pill[data-tone="playing"] {
        color: var(--dsw-alias-state-success-primary, var(--dsw-alias-label-primary));
        border-color: var(--dsw-alias-state-success-primary, var(--dsw-alias-border-l3));
      }
      .infc-pill[data-tone="paused"] {
        color: var(--dsw-alias-state-warn-label, var(--dsw-alias-label-primary));
        border-color: var(--dsw-alias-state-warn-label, var(--dsw-alias-border-l3));
      }
      .infc-pill[data-tone="error"] {
        color: var(--dsw-alias-label-error, var(--dsw-alias-label-primary));
        border-color: var(--dsw-alias-label-error, var(--dsw-alias-border-l3));
      }
      .infc-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }
      .infc-media-box {
        padding: 14px 16px;
        border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-base);
        border: 1px solid var(--dsw-alias-border-l2);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .infc-media-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary);
      }
      .infc-media-empty {
        font-size: 13px;
        color: var(--dsw-alias-label-secondary);
      }
      .infc-progress-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        font-family: var(--dsw-font-code, monospace);
        color: var(--dsw-alias-label-secondary);
      }
      .infc-progress-track {
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: var(--dsw-alias-border-l2);
        overflow: hidden;
      }
      .infc-progress-fill {
        height: 100%;
        border-radius: 999px;
        background: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary));
        transition: width 0.2s linear;
      }
      .infc-btn-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .infc-btn {
        appearance: none;
        border: 1px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));
        background: var(--dsw-alias-bg-base);
        color: var(--dsw-alias-label-primary);
        border-radius: var(--dsw-radius-sm, 8px);
        padding: 7px 14px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .infc-btn:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover);
      }
      .infc-btn:active:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-active);
      }
      .infc-btn:disabled {
        opacity: 0.48;
        cursor: not-allowed;
      }
      .infc-btn-primary {
        background: var(--dsw-alias-label-primary);
        color: var(--dsw-alias-bg-base);
        border-color: var(--dsw-alias-label-primary);
      }
      .infc-btn-primary:hover:not(:disabled) {
        background: var(--dsw-alias-label-secondary);
        border-color: var(--dsw-alias-label-secondary);
      }
      .infc-notice {
        font-size: 12px;
        padding: 8px 12px;
        border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-layer-2);
        color: var(--dsw-alias-label-secondary);
        border: 1px solid var(--dsw-alias-border-l2);
      }
      .infc-notice[data-tone="error"] {
        color: var(--dsw-alias-label-error, var(--dsw-alias-label-primary));
        border-color: var(--dsw-alias-label-error, var(--dsw-alias-border-l3));
      }
      .infc-rule-list {
        display: flex;
        flex-direction: column;
        divide-y: 1px solid var(--dsw-alias-border-l2);
      }
      .infc-rule-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-top: 1px solid var(--dsw-alias-border-l2);
      }
      .infc-rule-item:first-child {
        border-top: none;
        padding-top: 4px;
      }
      .infc-rule-item:last-child {
        padding-bottom: 2px;
      }
      .infc-rule-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--dsw-alias-label-primary);
      }
      .infc-rule-desc {
        font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        margin-top: 2px;
      }
      .infc-switch {
        position: relative;
        width: 38px;
        height: 22px;
        border-radius: 999px;
        border: 1px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));
        background: var(--dsw-alias-bg-base);
        cursor: pointer;
        padding: 2px;
        flex-shrink: 0;
        transition: background 0.15s ease;
      }
      .infc-switch[aria-checked="true"] {
        background: var(--dsw-alias-label-primary);
        border-color: var(--dsw-alias-label-primary);
      }
      .infc-switch-thumb {
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--dsw-alias-label-secondary);
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .infc-switch[aria-checked="true"] .infc-switch-thumb {
        transform: translateX(16px);
        background: var(--dsw-alias-bg-base);
      }
      .infc-history-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .infc-history-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-base);
        border: 1px solid var(--dsw-alias-border-l2);
        font-size: 12px;
        flex-wrap: wrap;
      }
      .infc-history-main {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .infc-history-time {
        font-family: var(--dsw-font-code, monospace);
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
      }
      .infc-glyph {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
    `;

    function makePage(t) {
      class PageBoundary extends React.Component {
        constructor(props) {
          super(props);
          this.state = { failed: false };
        }
        static getDerivedStateFromError() {
          return { failed: true };
        }
        componentDidCatch(err) {
          try {
            console.error('[infuse-companion] page error:', err);
          } catch {}
        }
        render() {
          if (this.state.failed) {
            return h('div', { className: 'infc-root', role: 'status' }, t('error.internal'));
          }
          return this.props.children;
        }
      }

      function SwitchControl({ checked, disabled, onChange, label }) {
        return h(
          'button',
          {
            type: 'button',
            role: 'switch',
            'aria-checked': Boolean(checked),
            'aria-label': label,
            disabled: Boolean(disabled),
            className: 'infc-switch',
            onClick: () => {
              if (!disabled && typeof onChange === 'function') onChange(!checked);
            },
          },
          h('span', { className: 'infc-switch-thumb' }),
        );
      }

      function InfuseWorkbench() {
        const [snapshot, setSnapshot] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        const [notice, setNotice] = React.useState(null);
        const [nowMs, setNowMs] = React.useState(() => Date.now());
        const aliveRef = React.useRef(true);
        const clockAnchorRef = React.useRef({
          mediaLabel: '',
          basePos: 0,
          baseTimeMs: 0,
          playing: false,
        });

        const applyIncomingSnapshot = React.useCallback((data) => {
          const now = Date.now();
          const inf = data && data.infuse ? data.infuse : null;
          if (inf && inf.state === 'playing' && typeof inf.positionSeconds === 'number') {
            const prev = clockAnchorRef.current;
            const label = inf.mediaLabel || '';
            if (prev.playing && prev.mediaLabel === label) {
              const currentLivePos = prev.basePos + Math.max(0, (now - prev.baseTimeMs) / 1000);
              const drift = inf.positionSeconds - currentLivePos;
              // Snap only if user seeked (> 2.2s difference); otherwise keep continuous 1s wall-clock pacing
              if (Math.abs(drift) > 2.2) {
                clockAnchorRef.current = {
                  mediaLabel: label,
                  basePos: inf.positionSeconds,
                  baseTimeMs: now,
                  playing: true,
                };
              } else if (drift > 0.35) {
                // Gentle forward-only nudge so the second counter never steps backward
                clockAnchorRef.current = {
                  mediaLabel: label,
                  basePos: currentLivePos + drift * 0.25,
                  baseTimeMs: now,
                  playing: true,
                };
              }
            } else {
              clockAnchorRef.current = {
                mediaLabel: label,
                basePos: inf.positionSeconds,
                baseTimeMs: now,
                playing: true,
              };
            }
          } else {
            clockAnchorRef.current = {
              mediaLabel: (inf && inf.mediaLabel) || '',
              basePos: inf && typeof inf.positionSeconds === 'number' ? inf.positionSeconds : 0,
              baseTimeMs: now,
              playing: false,
            };
          }
          setSnapshot(data);
          setNowMs(now);
        }, []);

        const translateError = React.useCallback((err) => {
          const code = err && err.code ? err.code : 'internal';
          const key = `error.${code}`;
          const msg = t(key);
          return msg !== key ? msg : t('error.internal') + (err && err.detail ? ` (${err.detail})` : '');
        }, []);

        const refreshStatus = React.useCallback(
          async (silent) => {
            if (!silent) setBusy(true);
            try {
              const data = await callHost('status', {});
              if (!aliveRef.current) return;
              applyIncomingSnapshot(data);
              if (!silent) setNotice(null);
            } catch (err) {
              if (!aliveRef.current) return;
              if (!silent) {
                setNotice({ tone: 'error', text: translateError(err) });
              }
            } finally {
              if (aliveRef.current && !silent) setBusy(false);
            }
          },
          [applyIncomingSnapshot, translateError],
        );

        React.useEffect(() => {
          aliveRef.current = true;
          refreshStatus(false);
          const pollTimer = setInterval(() => {
            refreshStatus(true);
          }, 2000);
          const clockTimer = setInterval(() => {
            if (clockAnchorRef.current.playing) {
              setNowMs(Date.now());
            }
          }, 200);
          return () => {
            aliveRef.current = false;
            clearInterval(pollTimer);
            clearInterval(clockTimer);
          };
        }, [refreshStatus]);

        const runAction = async (op, args) => {
          setBusy(true);
          setNotice(null);
          try {
            const data = await callHost(op, args || {});
            if (!aliveRef.current) return;
            applyIncomingSnapshot(data);
            if (op === 'configure') {
              setNotice({
                tone: 'info',
                text: data.persisted ? t('rules.saved') : t('rules.memoryOnly'),
              });
            } else if (data.outcome) {
              const outKey = `outcome.${data.outcome}`;
              const outText = t(outKey);
              setNotice({
                tone: data.outcome === 'failed' ? 'error' : 'info',
                text: outText !== outKey ? outText : data.outcome,
              });
            }
          } catch (err) {
            if (!aliveRef.current) return;
            setNotice({ tone: 'error', text: translateError(err) });
          } finally {
            if (aliveRef.current) setBusy(false);
          }
        };

        const infuse = snapshot && snapshot.infuse ? snapshot.infuse : { state: 'offline', running: false };
        const rawPos = typeof infuse.positionSeconds === 'number' ? infuse.positionSeconds : null;
        const durationSec =
          typeof infuse.durationSeconds === 'number' && infuse.durationSeconds > 0
            ? infuse.durationSeconds
            : null;
        let livePositionSeconds = rawPos;
        if (infuse.state === 'playing' && rawPos !== null && clockAnchorRef.current.playing) {
          const elapsedSec = Math.max(0, (nowMs - clockAnchorRef.current.baseTimeMs) / 1000);
          const interpolated = clockAnchorRef.current.basePos + elapsedSec;
          livePositionSeconds = durationSec !== null ? Math.min(durationSec, interpolated) : interpolated;
        }
        const liveProgressPercent =
          livePositionSeconds !== null && durationSec !== null
            ? Math.max(0, Math.min(100, Math.round((livePositionSeconds / durationSec) * 1000) / 10))
            : infuse.progressPercent;
        const config =
          snapshot && snapshot.config
            ? snapshot.config
            : {
                enabled: true,
                pauseOnTurnComplete: true,
                pauseOnApprovalNeeded: true,
                pauseOnQuestionAsked: true,
                onlyRootSessions: true,
              };
        const lastAutoPause = snapshot ? snapshot.lastAutoPause : null;
        const history = snapshot && Array.isArray(snapshot.history) ? snapshot.history : [];

        const stateKey =
          infuse.state === 'playing'
            ? 'playing'
            : infuse.state === 'paused'
              ? 'paused'
              : infuse.running
                ? 'idle'
                : 'offline';
        const stateTone =
          stateKey === 'playing' ? 'playing' : stateKey === 'paused' ? 'paused' : 'neutral';

        const ruleRows = [
          {
            key: 'enabled',
            title: t('rules.enabled.title'),
            desc: t('rules.enabled.desc'),
          },
          {
            key: 'pauseOnTurnComplete',
            title: t('rules.turnComplete.title'),
            desc: t('rules.turnComplete.desc'),
          },
          {
            key: 'pauseOnApprovalNeeded',
            title: t('rules.approvalNeeded.title'),
            desc: t('rules.approvalNeeded.desc'),
          },
          {
            key: 'pauseOnQuestionAsked',
            title: t('rules.questionAsked.title'),
            desc: t('rules.questionAsked.desc'),
          },
          {
            key: 'onlyRootSessions',
            title: t('rules.onlyRoot.title'),
            desc: t('rules.onlyRoot.desc'),
          },
        ];

        return h(
          'div',
          { className: 'infc-root' },
          h('style', null, STYLES),
          h(
            'div',
            { className: 'infc-container' },
            // Header
            h(
              'div',
              { className: 'infc-header' },
              h(
                'div',
                null,
                h(
                  'h1',
                  {
                    className: 'infc-title',
                    style: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
                  },
                  h(PanelGlyph, { size: 20, active: true }),
                  t('page.title'),
                ),
                h('p', { className: 'infc-subtitle' }, t('page.subtitle')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'infc-btn',
                  disabled: busy,
                  onClick: () => refreshStatus(false),
                },
                busy ? t('status.refreshing') : t('status.refresh'),
              ),
            ),

            // Notice line
            notice
              ? h(
                  'div',
                  {
                    className: 'infc-notice',
                    role: 'status',
                    'data-tone': notice.tone || 'info',
                  },
                  notice.text,
                )
              : null,

            // Auto-Pause Banner when active
            lastAutoPause
              ? h(
                  'div',
                  { className: 'infc-banner', role: 'status' },
                  h(
                    'div',
                    null,
                    h('div', { className: 'infc-banner-title' }, '⏸ ' + t('banner.autoPausedTitle')),
                    h(
                      'div',
                      { className: 'infc-banner-meta' },
                      h(
                        'span',
                        null,
                        `${t('banner.reason')}: ${t('reason.' + lastAutoPause.reason)}`,
                      ),
                      lastAutoPause.sessionTitle
                        ? h('span', null, `${t('banner.session')}: ${lastAutoPause.sessionTitle}`)
                        : null,
                      lastAutoPause.mediaLabel
                        ? h(
                            'span',
                            null,
                            `${t('banner.media')}: ${lastAutoPause.mediaLabel}${
                              lastAutoPause.positionSeconds !== null
                                ? ' (' + formatClock(lastAutoPause.positionSeconds) + ')'
                                : ''
                            }`,
                          )
                        : null,
                    ),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'infc-btn infc-btn-primary',
                      disabled: busy || !infuse.running,
                      onClick: () => runAction('resume', {}),
                    },
                    '▶ ' + t('banner.resumeNow'),
                  ),
                )
              : null,

            // Now Playing Card
            h(
              'section',
              { className: 'infc-card' },
              h(
                'div',
                { className: 'infc-card-header' },
                h('h2', { className: 'infc-section-title' }, t('nowPlaying.sectionTitle')),
                h(
                  'div',
                  { className: 'infc-badges' },
                  h(
                    'span',
                    { className: 'infc-pill', 'data-tone': stateTone },
                    h('span', { className: 'infc-dot' }),
                    t(`status.${stateKey}`),
                  ),
                  infuse.running
                    ? h(
                        'span',
                        {
                          className: 'infc-pill',
                          'data-tone': infuse.axTrusted ? 'playing' : 'error',
                        },
                        infuse.axTrusted ? t('status.axReady') : t('status.axMissing'),
                      )
                    : null,
                  infuse.running
                    ? h(
                        'span',
                        { className: 'infc-pill' },
                        infuse.menuItemEnabled ? t('status.menuReady') : t('status.menuDisabled'),
                      )
                    : null,
                  infuse.pid
                    ? h('span', { className: 'infc-pill' }, `${t('nowPlaying.pid')}: ${infuse.pid}`)
                    : null,
                ),
              ),

              h(
                'div',
                { className: 'infc-media-box' },
                infuse.mediaLabel
                  ? h(
                      React.Fragment,
                      null,
                      h('div', { className: 'infc-media-title' }, infuse.mediaLabel),
                      infuse.durationSeconds
                        ? h(
                            React.Fragment,
                            null,
                            h(
                              'div',
                              { className: 'infc-progress-track' },
                              h('div', {
                                className: 'infc-progress-fill',
                                style: {
                                  width: `${Math.min(100, Math.max(0, liveProgressPercent || 0))}%`,
                                },
                              }),
                            ),
                            h(
                              'div',
                              { className: 'infc-progress-row' },
                              h(
                                'span',
                                null,
                                `${formatClock(livePositionSeconds || 0)} / ${formatClock(
                                  infuse.durationSeconds,
                                )}`,
                              ),
                              h(
                                'span',
                                null,
                                liveProgressPercent !== null && liveProgressPercent !== undefined
                                  ? `${liveProgressPercent}%`
                                  : '',
                              ),
                            ),
                          )
                        : null,
                    )
                  : h(
                      'div',
                      { className: 'infc-media-empty' },
                      h('div', { style: { fontWeight: 500, marginBottom: 4 } }, t('nowPlaying.noMedia')),
                      h('div', null, t('nowPlaying.noMediaHint')),
                    ),
              ),

              h(
                'div',
                { className: 'infc-btn-row' },
                h(
                  'button',
                  {
                    type: 'button',
                    className:
                      infuse.state === 'playing' ? 'infc-btn infc-btn-primary' : 'infc-btn',
                    disabled: busy || !infuse.running || infuse.state !== 'playing',
                    onClick: () => runAction('pause', {}),
                  },
                  '⏸ ' + t('actions.pause'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className:
                      infuse.state === 'paused' ? 'infc-btn infc-btn-primary' : 'infc-btn',
                    disabled: busy || !infuse.running || infuse.state === 'playing',
                    onClick: () => runAction('resume', {}),
                  },
                  '▶ ' + t('actions.resume'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'infc-btn',
                    disabled: busy || !infuse.running,
                    onClick: () => runAction('toggle', {}),
                  },
                  '⏯ ' + t('actions.toggle'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'infc-btn',
                    disabled: busy,
                    onClick: () => runAction('simulate_trigger', {}),
                  },
                  '⚡ ' + t('actions.simTrigger'),
                ),
              ),
            ),

            // Rules Card
            h(
              'section',
              { className: 'infc-card' },
              h(
                'div',
                null,
                h('h2', { className: 'infc-section-title' }, t('rules.sectionTitle')),
                h('p', { className: 'infc-section-desc' }, t('rules.sectionDesc')),
              ),
              h(
                'div',
                { className: 'infc-rule-list' },
                ruleRows.map((row) =>
                  h(
                    'div',
                    { key: row.key, className: 'infc-rule-item' },
                    h(
                      'div',
                      null,
                      h('div', { className: 'infc-rule-title' }, row.title),
                      h('div', { className: 'infc-rule-desc' }, row.desc),
                    ),
                    h(SwitchControl, {
                      checked: Boolean(config[row.key]),
                      disabled: busy || (row.key !== 'enabled' && !config.enabled),
                      label: row.title,
                      onChange: (nextVal) =>
                        runAction('configure', { config: { [row.key]: nextVal } }),
                    }),
                  ),
                ),
              ),
            ),

            // History Card
            h(
              'section',
              { className: 'infc-card' },
              h(
                'div',
                { className: 'infc-card-header' },
                h('h2', { className: 'infc-section-title' }, t('history.sectionTitle')),
                history.length > 0
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'infc-btn',
                        disabled: busy,
                        onClick: () => runAction('clear_history', {}),
                      },
                      t('history.clear'),
                    )
                  : null,
              ),
              history.length === 0
                ? h('div', { className: 'infc-media-empty' }, t('history.empty'))
                : h(
                    'div',
                    { className: 'infc-history-list' },
                    history.map((item) =>
                      h(
                        'div',
                        { key: item.id, className: 'infc-history-row' },
                        h(
                          'div',
                          { className: 'infc-history-main' },
                          h(
                            'span',
                            {
                              className: 'infc-pill',
                              'data-tone':
                                item.outcome === 'paused'
                                  ? 'paused'
                                  : item.outcome === 'resumed'
                                    ? 'playing'
                                    : 'neutral',
                            },
                            t(`outcome.${item.outcome}`),
                          ),
                          h('span', { style: { fontWeight: 500 } }, t(`reason.${item.reason}`)),
                          item.sessionTitle
                            ? h('span', { style: { opacity: 0.8 } }, `· ${item.sessionTitle}`)
                            : null,
                          item.mediaLabel
                            ? h(
                                'span',
                                { style: { opacity: 0.8 } },
                                `· ${item.mediaLabel}${
                                  item.positionSeconds !== null
                                    ? ` (${formatClock(item.positionSeconds)})`
                                    : ''
                                }`,
                              )
                            : null,
                        ),
                        h('span', { className: 'infc-history-time' }, formatTimeOfDay(item.timestamp)),
                      ),
                    ),
                  ),
            ),
          ),
        );
      }

      return function InfuseCompanionPage(props) {
        return h(PageBoundary, null, h(InfuseWorkbench, props || {}));
      };
    }

    function PanelGlyph(props) {
      const size = props && typeof props.size === 'number' ? props.size : 16;
      const active = Boolean(props && props.active);
      return h(
        'span',
        {
          className: 'infc-glyph',
          'aria-hidden': 'true',
          style: {
            color: 'currentColor',
            opacity: active ? 1 : 0.88,
            transition: 'color 0.15s ease, opacity 0.15s ease',
          },
        },
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            xmlns: 'http://www.w3.org/2000/svg',
            focusable: 'false',
            'aria-hidden': 'true',
          },
          h('path', {
            d: INFUSE_MARK_PATH,
            fill: 'currentColor',
            stroke: active ? 'currentColor' : 'none',
            strokeWidth: active ? 0.35 : 0,
          }),
        ),
      );
    }

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'infuse-companion: dictionaries',
      );
      const t = ctx.locale.bind(NS);
      const PageComponent = makePage(t);

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 45,
            locale: NS,
            label: () => t('panel.label'),
          },
          PanelGlyph,
        ),
      );

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          },
          PageComponent,
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});
