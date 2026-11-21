import ActivityKit
import ExpoModulesCore

/// JS bridge for the focus timer Live Activity. All calls are no-ops where Live Activities are
/// unavailable or turned off, so the timer itself keeps working.
public class FocusActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FocusActivity")

    // At most one focus Live Activity: starting replaces any existing one.
    AsyncFunction("start") { (json: String) in
      guard #available(iOS 16.2, *) else { return }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
      let state = try Self.decode(json)
      await Self.endAll()
      _ = try Activity.request(attributes: FocusActivityAttributes(), content: ActivityContent(state: state, staleDate: state.endsAt))
    }

    AsyncFunction("update") { (json: String) in
      guard #available(iOS 16.2, *) else { return }
      let state = try Self.decode(json)
      for activity in Activity<FocusActivityAttributes>.activities {
        // staleDate = the moment time runs out; iOS re-renders then, which shows "Time's up".
        await activity.update(ActivityContent(state: state, staleDate: state.endsAt))
      }
    }

    AsyncFunction("end") {
      guard #available(iOS 16.2, *) else { return }
      await Self.endAll()
    }
  }

  @available(iOS 16.2, *)
  static func endAll() async {
    for activity in Activity<FocusActivityAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  static func decode(_ json: String) throws -> FocusActivityAttributes.ContentState {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .millisecondsSince1970
    return try decoder.decode(FocusActivityAttributes.ContentState.self, from: Data(json.utf8))
  }
}
