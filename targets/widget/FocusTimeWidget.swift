import SwiftUI
import WidgetKit

/// Focused time as bars: 3 days (small), 7 days (medium), 14 days plus time by tag (large). Today is solid red.
struct FocusTimeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FocusTimeWidget", provider: Provider()) { entry in
      FocusTimeView(entry: entry)
        .containerBackground(Color.widgetBackground, for: .widget)
        .widgetURL(URL(string: "system2://activity"))
    }
    .configurationDisplayName("Focus time")
    .description("Time you focused, day by day.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct FocusTimeView: View {
  let entry: Entry
  @Environment(\.widgetFamily) private var family

  private var focus: [String: Double] { entry.snapshot.focus ?? [:] }
  private var today: String { entry.today }
  /// Seconds focused over `days` days, ending `ago` days before today.
  private func total(_ days: Int, ago: Int = 0) -> Int {
    Int((0..<days).reduce(0) { $0 + (focus[Day.add(today, -$1 - ago)] ?? 0) })
  }

  var body: some View {
    switch family {
    case .systemSmall:
      VStack(alignment: .leading, spacing: 0) {
        Text(duration(total(1))).font(.system(size: 28, weight: .bold)).roundedNumbers()
        Text("focused today").font(.system(size: 13)).foregroundStyle(.secondary)
        Spacer(minLength: 8)
        FocusBars(focus: focus, today: today, days: 3, height: 40, spacing: 12, radius: 7, values: true)
      }
    case .systemMedium:
      VStack(spacing: 0) {
        HStack(alignment: .firstTextBaseline) {
          (Text(duration(total(1))).fontDesign(.rounded) + Text(" today")).font(.system(size: 15, weight: .semibold))
          Spacer()
          Text("\(duration(total(7))) in 7 days").font(.system(size: 13, weight: .medium)).roundedNumbers().foregroundStyle(.secondary)
        }
        Spacer(minLength: 6)
        FocusBars(focus: focus, today: today, days: 7, height: 84)
      }
    default:
      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .top) {
          bigStat(duration(total(1)), "today")
          Spacer()
          bigStat(duration(total(7)), weekChange, trailing: true)
        }
        Spacer(minLength: 10)
        VStack(spacing: 8) {
          header("Last 14 days", "\(duration(total(14) / 14)) a day")
          FocusBars(focus: focus, today: today, days: 14, height: 72, spacing: 6, radius: 5)
        }
        Spacer(minLength: 10)
        tagRows
      }
    }
  }

  private var weekChange: String {
    let diff = total(7) - total(7, ago: 7)
    return diff == 0 ? "in 7 days" : "\(diff > 0 ? "+" : "−")\(duration(abs(diff))) on last week"
  }

  private var tagRows: some View {
    let tags = Array((entry.snapshot.focusTags ?? []).prefix(4))
    let peak = max(1, tags.first?.seconds ?? 1)
    return VStack(alignment: .leading, spacing: 8) {
      header("By tag", "last 7 days")
      if tags.isEmpty {
        Text("Start a focus timer to see where your time goes.").font(.system(size: 13)).foregroundStyle(.secondary)
      }
      ForEach(tags, id: \.self) { t in
        let color = t.color.flatMap(Color.init(hex:)) ?? Color(UIColor.systemGray)
        HStack(spacing: 8) {
          Circle().fill(color).frame(width: 8, height: 8)
          Text(t.name).font(.system(size: 13, weight: .medium)).lineLimit(1).frame(width: 64, alignment: .leading)
          GeometryReader { g in
            ZStack(alignment: .leading) {
              Capsule().fill(Color.emptyFill)
              Capsule().fill(color).frame(width: max(6, g.size.width * t.seconds / peak))
            }
          }
          .frame(height: 6)
          Text(duration(Int(t.seconds))).font(.system(size: 13, weight: .medium)).roundedNumbers()
            .foregroundStyle(.secondary).frame(width: 50, alignment: .trailing)
        }
      }
    }
  }

  private func header(_ left: String, _ right: String) -> some View {
    HStack(alignment: .firstTextBaseline) {
      Text(left).font(.system(size: 13, weight: .semibold))
      Spacer()
      Text(right).font(.system(size: 13)).roundedNumbers().foregroundStyle(.secondary)
    }
  }

  private func bigStat(_ value: String, _ label: String, trailing: Bool = false) -> some View {
    VStack(alignment: trailing ? .trailing : .leading, spacing: 0) {
      Text(value).font(.system(size: 32, weight: .bold)).roundedNumbers()
      Text(label).font(.system(size: 13)).foregroundStyle(.secondary)
    }
  }
}

/// The last `days` days as bottom-aligned bars, today last. Empty days get a short grey stub.
struct FocusBars: View {
  let focus: [String: Double]
  let today: String
  let days: Int
  let height: CGFloat
  var spacing: CGFloat = 10
  var radius: CGFloat = 6
  var values = false  // small: the time above each bar and day names below

  var body: some View {
    let list = (0..<days).map { Day.add(today, $0 - days + 1) }
    let peak = max(1800, list.map { focus[$0] ?? 0 }.max() ?? 0)  // 30m floor so one short session doesn't fill the chart
    HStack(alignment: .bottom, spacing: spacing) {
      ForEach(list, id: \.self) { day in
        let s = focus[day] ?? 0
        let isToday = day == today
        VStack(spacing: 5) {
          if values {
            Text(duration(Int(s))).font(.system(size: 11, weight: .semibold)).roundedNumbers()
              .foregroundStyle(isToday ? .primary : .secondary).lineLimit(1).minimumScaleFactor(0.8)
          }
          RoundedRectangle(cornerRadius: s > 0 ? radius : 2)
            .fill(s > 0 ? Color(UIColor.systemRed).opacity(isToday ? 1 : 0.5) : .emptyFill)
            .frame(height: s > 0 ? max(4, s / peak * height) : 4)
          Text(values ? (isToday ? "Today" : Day.format(day, "EEE")) : Day.format(day, "EEEEE"))
            .font(.system(size: 11, weight: isToday ? .bold : .medium))
            .foregroundStyle(isToday ? .primary : .secondary)
        }
        .frame(maxWidth: .infinity)
      }
    }
    .frame(height: height + (values ? 36 : 18), alignment: .bottom)
  }
}
