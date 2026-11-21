// Shared by the app (via the FocusActivity module) and the widget extension, which symlinks this
// file. ActivityKit matches the two copies of FocusActivityAttributes by type name, so this one
// file keeps them identical.
import ActivityKit
import AppIntents
import Foundation

public struct FocusActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var title: String
    public var tag: String?
    public var tagColor: String?  // "#RRGGBB"
    public var due: String  // "Due today", "Due last Thursday"
    public var totalSec: Int  // focused on this task so far
    public var plannedSec: Int
    public var endsAt: Date?  // nil while paused
    public var remainingSec: Int  // what's left while paused
  }
  public init() {}
}

/// Pause / resume from the Lock Screen or Dynamic Island. As a LiveActivityIntent it runs in the
/// app's process. It updates the Live Activity right away and flips the shared timer that the app
/// reads back when it next comes to the foreground.
@available(iOS 17.0, *)
public struct ToggleFocusIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Pause or resume focus"
  public init() {}
  public func perform() async throws -> some IntentResult {
    await FocusShared.toggle()
    return .result()
  }
}

public enum FocusShared {
  /// "group.<app bundle id>.shared", from either the app or the widget extension ("<app id>.widget").
  public static var appGroup: String {
    let id = Bundle.main.bundleIdentifier ?? ""
    return "group.\(id.hasSuffix(".widget") ? String(id.dropLast(".widget".count)) : id).shared"
  }

  static let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]  // matches JS toISOString()
    return f
  }()

  @available(iOS 16.2, *)
  public static func toggle() async {
    let now = Date()
    let defaults = UserDefaults(suiteName: appGroup)
    // Same rules as pauseTimer/resumeTimer in src/domain.ts.
    if let json = defaults?.string(forKey: "timer"),
      var t = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any]
    {
      let planned = (t["plannedSec"] as? NSNumber)?.doubleValue ?? 0
      var accrued = (t["accruedSec"] as? NSNumber)?.doubleValue ?? 0
      if let run = (t["runStartedAt"] as? String).flatMap(iso.date(from:)) {
        accrued = min(planned, accrued + now.timeIntervalSince(run))
        t["runStartedAt"] = NSNull()
      } else if accrued < planned {
        t["runStartedAt"] = iso.string(from: now)
      }
      t["accruedSec"] = accrued
      t["updatedAt"] = iso.string(from: now)
      if let data = try? JSONSerialization.data(withJSONObject: t) {
        defaults?.set(String(decoding: data, as: UTF8.self), forKey: "timer")
      }
    }
    for activity in Activity<FocusActivityAttributes>.activities {
      var s = activity.content.state
      if let ends = s.endsAt {
        s.remainingSec = max(0, Int(ends.timeIntervalSince(now).rounded()))
        s.endsAt = nil
      } else if s.remainingSec > 0 {
        s.endsAt = now.addingTimeInterval(TimeInterval(s.remainingSec))
      }
      await activity.update(ActivityContent(state: s, staleDate: s.endsAt))
    }
  }
}
