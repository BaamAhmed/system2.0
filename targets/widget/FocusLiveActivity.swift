import ActivityKit
import SwiftUI
import WidgetKit

/// The focus timer on the Lock Screen and in the Dynamic Island. Black in both modes, like the Island.
struct FocusLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FocusActivityAttributes.self) { context in
      FocusActivityCard(state: context.state, timeUp: timeUp(context))
        .padding(.horizontal, 22).padding(.top, 20).padding(.bottom, 18)
        .activityBackgroundTint(Color.black.opacity(0.82))
        .activitySystemActionForegroundColor(.white)
        .widgetURL(URL(string: "system2://focus?timer=1"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.bottom) {
          FocusActivityCard(state: context.state, timeUp: timeUp(context), compact: true)
            .padding(.horizontal, 6).padding(.bottom, 6)
        }
      } compactLeading: {
        FocusRing(state: context.state, timeUp: timeUp(context)).frame(width: 20, height: 20)
      } compactTrailing: {
        FocusCountdown(state: context.state, timeUp: timeUp(context))
          .font(.system(size: 15, weight: .semibold, design: .rounded))
          .frame(maxWidth: 58)
      } minimal: {
        FocusRing(state: context.state, timeUp: timeUp(context)).frame(width: 22, height: 22)
      }
      .widgetURL(URL(string: "system2://focus?timer=1"))
    }
  }

  // The stale date is set to the moment time runs out, so iOS re-renders right then with isStale.
  private func timeUp(_ context: ActivityViewContext<FocusActivityAttributes>) -> Bool {
    context.state.endsAt != nil && (context.isStale || context.state.endsAt! <= .now)
  }
}

private let secondary = Color(white: 0.92).opacity(0.6)
private let track = Color.white.opacity(0.14)

struct FocusActivityCard: View {
  let state: FocusActivityAttributes.ContentState
  let timeUp: Bool
  var compact = false

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 14 : 18) {
      HStack(alignment: .top, spacing: 16) {
        VStack(alignment: .leading, spacing: 4) {
          HStack(alignment: .firstTextBaseline, spacing: 7) {
            Circle().fill(state.tagColor.flatMap(Color.init(hex:)) ?? .white).frame(width: 8, height: 8)
              .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 1 }
            Text(state.title)
              .font(.system(size: compact ? 15 : 16, weight: .semibold))
              .lineLimit(3)  // long titles wrap instead of truncating
              .fixedSize(horizontal: false, vertical: true)
          }
          Group {
            Text(meta)
            Label { Text("\(duration(state.totalSec)) on this task") } icon: { Image(systemName: "clock") }
              .labelStyle(TightLabel())
          }
          .font(.system(size: compact ? 12 : 13))
          .foregroundStyle(secondary)
          .padding(.leading, 15)
        }
        Spacer(minLength: 0)
        Group {
          if timeUp {
            Text("Time’s up").font(.system(size: compact ? 20 : 22, weight: .bold))
          } else {
            FocusCountdown(state: state, timeUp: false)
              .font(.system(size: compact ? 28 : 36, weight: .bold, design: .rounded))
          }
        }
        .foregroundStyle(state.endsAt == nil && !timeUp ? secondary : .white)
      }
      HStack(spacing: 14) {
        FocusProgress(state: state, timeUp: timeUp).frame(height: 5)
        if #available(iOS 17.0, *), !timeUp {
          // Pause / resume only; stopping or adding time happens in the app.
          Button(intent: ToggleFocusIntent()) {
            Image(systemName: state.endsAt == nil ? "play.fill" : "pause.fill")
              .font(.system(size: 14, weight: .bold))
              .foregroundStyle(.black)
              .frame(width: compact ? 34 : 36, height: compact ? 34 : 36)
              .background(Circle().fill(.white))
          }
          .buttonStyle(.plain)
          .accessibilityLabel(state.endsAt == nil ? "Resume focus" : "Pause focus")
        }
      }
    }
    .foregroundStyle(.white)
  }

  private var meta: String { [state.tag, state.due].compactMap { $0 }.joined(separator: " · ") }
}

/// Counts down by itself while running (no updates needed); the digits roll as they change.
struct FocusCountdown: View {
  let state: FocusActivityAttributes.ContentState
  let timeUp: Bool
  var body: some View {
    Group {
      if timeUp {
        Text("0:00")
      } else if let ends = state.endsAt {
        Text(timerInterval: ends.addingTimeInterval(-Double(state.plannedSec))...ends, countsDown: true)
      } else {
        Text(clock(state.remainingSec))
      }
    }
    .monospacedDigit()
    .contentTransition(.numericText(countsDown: true))
    .multilineTextAlignment(.trailing)
  }
}

struct FocusProgress: View {
  let state: FocusActivityAttributes.ContentState
  let timeUp: Bool
  var body: some View {
    Group {
      if let ends = state.endsAt, !timeUp {
        ProgressView(timerInterval: ends.addingTimeInterval(-Double(state.plannedSec))...ends, countsDown: false) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
      } else {
        ProgressView(value: timeUp ? 1 : fraction(state))
      }
    }
    .progressViewStyle(.linear)
    .tint(.white)
    .background(Capsule().fill(track))
  }
}

struct FocusRing: View {
  let state: FocusActivityAttributes.ContentState
  let timeUp: Bool
  var body: some View {
    let tint = state.tagColor.flatMap(Color.init(hex:)) ?? .white
    Group {
      if let ends = state.endsAt, !timeUp {
        ProgressView(timerInterval: ends.addingTimeInterval(-Double(state.plannedSec))...ends, countsDown: true) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
      } else {
        ProgressView(value: timeUp ? 0 : 1 - fraction(state))
      }
    }
    .progressViewStyle(.circular)
    .tint(tint)
  }
}

private struct TightLabel: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    HStack(spacing: 5) { configuration.icon.imageScale(.small); configuration.title }
  }
}

private func fraction(_ s: FocusActivityAttributes.ContentState) -> Double {
  s.plannedSec > 0 ? min(1, max(0, 1 - Double(s.remainingSec) / Double(s.plannedSec))) : 0
}

/// "24:13" or "1:08:40" (same as formatClock in src/domain.ts).
private func clock(_ seconds: Int) -> String {
  let h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60
  return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
}

/// "1h 20m", "45m" (same as formatDuration in src/domain.ts).
private func duration(_ seconds: Int) -> String {
  let m = seconds / 60
  if seconds > 0 && m == 0 { return "<1m" }
  let h = m / 60
  return h > 0 ? (m % 60 > 0 ? "\(h)h \(m % 60)m" : "\(h)h") : "\(m)m"
}
