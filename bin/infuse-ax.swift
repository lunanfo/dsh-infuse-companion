import Foundation
import AppKit
import ApplicationServices

func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
    var v: AnyObject?
    return AXUIElementCopyAttributeValue(el, name as CFString, &v) == .success ? v : nil
}

func kids(_ el: AXUIElement) -> [AXUIElement] {
    (attr(el, kAXChildrenAttribute) as? NSArray)?.map { $0 as! AXUIElement } ?? []
}

func str(_ el: AXUIElement, _ name: String) -> String {
    attr(el, name) as? String ?? ""
}

func isPlayPauseTitle(_ t: String) -> Bool {
    let lower = t.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return t == "播放/暂停" || t == "播放" || t == "暂停" ||
           lower == "play/pause" || lower == "play" || lower == "pause"
}

func searchBarItem(_ barItem: AXUIElement) -> (item: AXUIElement, title: String, enabled: Bool)? {
    for menu in kids(barItem) {
        for item in kids(menu) {
            let ch = str(item, kAXMenuItemCmdCharAttribute)
            let mods = attr(item, kAXMenuItemCmdModifiersAttribute) as? Int ?? 0
            let t = str(item, kAXTitleAttribute)
            if (ch == " " && mods == 0) || isPlayPauseTitle(t) {
                let en = attr(item, kAXEnabledAttribute) as? Bool ?? false
                return (item, t, en)
            }
        }
    }
    return nil
}

func findPlayPauseMenuItem(_ appEl: AXUIElement) -> (item: AXUIElement, title: String, enabled: Bool)? {
    guard let mb = attr(appEl, kAXMenuBarAttribute) else { return nil }
    let barItems = kids(mb as! AXUIElement)
    // Fast path: index 4 is "播放设置" / "Playback" in Infuse on macOS
    if barItems.count > 4, let hit = searchBarItem(barItems[4]) {
        return hit
    }
    let skipTitles: Set<String> = ["Apple", "Infuse", "文件", "编辑", "窗口", "帮助", "File", "Edit", "Window", "Help"]
    for (idx, barItem) in barItems.enumerated() where idx != 0 && idx != 4 {
        let bt = str(barItem, kAXTitleAttribute)
        if skipTitles.contains(bt) { continue }
        if let hit = searchBarItem(barItem) { return hit }
    }
    for (idx, barItem) in barItems.enumerated() where idx != 0 && idx != 4 {
        if let hit = searchBarItem(barItem) { return hit }
    }
    return nil
}

let action = CommandLine.arguments.dropFirst().first ?? "inspect"
let trusted = AXIsProcessTrusted()
let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.firecore.infuse")
guard let infuse = apps.first else {
    let out: [String: Any] = [
        "ok": true,
        "running": false,
        "axTrusted": trusted
    ]
    let data = try! JSONSerialization.data(withJSONObject: out)
    print(String(data: data, encoding: .utf8)!)
    exit(0)
}

let pid = infuse.processIdentifier
let appEl = AXUIElementCreateApplication(pid)
let found = findPlayPauseMenuItem(appEl)

var pressed = false
var pressError: Int32 = 0
if action == "toggle" {
    if let target = found, target.enabled {
        let err = AXUIElementPerformAction(target.item, kAXPressAction as CFString)
        pressed = (err == .success)
        pressError = err.rawValue
    } else {
        pressError = -1
    }
}

let out: [String: Any] = [
    "ok": action == "inspect" ? true : pressed,
    "running": true,
    "pid": pid,
    "active": infuse.isActive,
    "axTrusted": trusted,
    "menuItemFound": found != nil,
    "menuItemTitle": found?.title ?? "",
    "menuItemEnabled": found?.enabled ?? false,
    "pressed": pressed,
    "pressError": pressError
]
let data = try! JSONSerialization.data(withJSONObject: out)
print(String(data: data, encoding: .utf8)!)
