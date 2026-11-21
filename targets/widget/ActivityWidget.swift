import SwiftUI
import WidgetKit

/// Heatmap of completed tasks per day. Squares are sized to fill the widget's width exactly.
struct ActivityWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ActivityWidget", provider: Provider()) { entry in
      ActivityView(entry: entry)
        .containerBackground(Color.widgetBackground, for: .widget)
        .widgetURL(URL(string: "system2://activity"))
    }
    .configurationDisplayName("Activity")
    .description("Tasks you finished, day by day.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
  }
}

struct ActivityView: View {
  let entry: Entry
  @Environment(\.widgetFamily) private var family

  private var counts: [String: Int] { entry.snapshot.counts }
  private var today: String { entry.today }

  private var streak: Int {
    var day = (counts[today] ?? 0) > 0 ? today : Day.add(today, -1)  // a quiet today doesn't break it yet
    var n = 0
    while (counts[day] ?? 0) > 0 { n += 1; day = Day.add(day, -1) }
    return n
  }
  private func total(days: Int) -> Int { (0..<days).reduce(0) { $0 + (counts[Day.add(today, -$1)] ?? 0) } }
  private var week: [Int?] {
    let mon = Day.weekStart(today)
    return (0..<7).map { i in
      let d = Day.add(mon, i)
      return d > today ? nil : (counts[d] ?? 0)
    }
  }

  var body: some View {
    switch family {
    case .systemSmall:
      HeatGrid(counts: counts, today: today, weeks: 7)  // 7×7 fills the small square
    case .systemMedium:
      VStack(alignment: .leading, spacing: 0) {
        header(right: "\(total(days: 140)) in 20 weeks")
        Spacer(minLength: 6)
        HeatGrid(counts: counts, today: today, weeks: 20)
      }
    case .systemLarge:
      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .top) {
          bigStat("\(streak)", "day streak, best \(max(entry.snapshot.bestStreak, streak))")
          Spacer()
          bigStat("\(total(days: 182))", "in 6 months", trailing: true)
        }
        Spacer(minLength: 10)
        HeatGrid(counts: counts, today: today, weeks: 26, months: true)
        Spacer(minLength: 10)
        weekBars(height: 56)
      }
    default:  // extra large (iPad)
      HStack(spacing: 28) {
        VStack(alignment: .leading) {
          bigStat("\(streak)", "day streak")
          Spacer()
          bigStat("\(max(entry.snapshot.bestStreak, streak))", "best streak")
          Spacer()
          bigStat("\(week.compactMap { $0 }.reduce(0, +))", "this week")
          Spacer()
          bigStat("\(total(days: 196))", "in 28 weeks")
        }
        .frame(width: 140, alignment: .leading)
        VStack(spacing: 0) {
          HeatGrid(counts: counts, today: today, weeks: 28, months: true)
          Spacer(minLength: 12)
          weekBars(height: 64)
        }
      }
    }
  }

  private func header(right: String) -> some View {
    HStack(alignment: .firstTextBaseline) {
      (Text("\(streak)").fontDesign(.rounded) + Text("-day streak")).font(.system(size: 15, weight: .semibold))
      Spacer()
      Text(right).font(.system(size: 13, weight: .medium)).roundedNumbers().foregroundStyle(.secondary)
    }
  }

  private func bigStat(_ value: String, _ label: String, trailing: Bool = false) -> some View {
    VStack(alignment: trailing ? .trailing : .leading, spacing: 0) {
      Text(value).font(.system(size: 32, weight: .bold)).roundedNumbers()
      Text(label).font(.system(size: 13)).foregroundStyle(.secondary)
    }
  }

  private func weekBars(height: CGFloat) -> some View {
    let values = week
    let todayIndex = Day.mondayIndex(today)
    let peak = CGFloat(max(4, values.compactMap { $0 }.max() ?? 0))
    return VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("This week").font(.system(size: 13, weight: .semibold))
        Spacer()
        Text("\(values.compactMap { $0 }.reduce(0, +)) done").font(.system(size: 13)).roundedNumbers().foregroundStyle(.secondary)
      }
      HStack(alignment: .bottom, spacing: 8) {
        ForEach(0..<7, id: \.self) { i in
          VStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 6)
              .fill(values[i] == nil ? Color.emptyFill : i == todayIndex ? Color(UIColor.systemRed) : .heat(2))
              .frame(height: values[i].map { max(4, CGFloat($0) / peak * height) } ?? 4)
            Text(["M", "T", "W", "T", "F", "S", "S"][i])
              .font(.system(size: 11, weight: i == todayIndex ? .bold : .medium))
              .foregroundStyle(i == todayIndex ? .primary : .secondary)
          }
          .frame(maxWidth: .infinity)
        }
      }
      .frame(height: height + 18, alignment: .bottom)
    }
  }
}

/// Weeks as columns (Monday first), drawn on a Canvas so squares fit the width exactly.
struct HeatGrid: View {
  let counts: [String: Int]
  let today: String
  let weeks: Int
  var months = false

  private let gapRatio: CGFloat = 0.22  // gap as a fraction of a square
  private var start: String { Day.add(Day.weekStart(today), -(weeks - 1) * 7) }
  private func square(for width: CGFloat) -> (sq: CGFloat, gap: CGFloat) {
    let sq = width / (CGFloat(weeks) + CGFloat(weeks - 1) * gapRatio)
    return (sq, sq * gapRatio)
  }

  var body: some View {
    VStack(spacing: 4) {
      if months {
        Canvas { ctx, size in
          let (sq, gap) = square(for: size.width)
          for w in 0..<(weeks - 2) {  // skip the last two columns so labels never clip
            let days = (0..<7).map { Day.add(start, w * 7 + $0) }
            guard let first = days.first(where: { $0.hasSuffix("-01") }) else { continue }
            let label = Text(Day.format(first, "MMM")).font(.system(size: 10, weight: .medium)).foregroundColor(.secondary)
            ctx.draw(label, at: CGPoint(x: CGFloat(w) * (sq + gap), y: size.height / 2), anchor: .leading)
          }
        }
        .frame(height: 12)
      }
      Canvas { ctx, size in
        let (sq, gap) = square(for: size.width)
        for w in 0..<weeks {
          for d in 0..<7 {
            let day = Day.add(start, w * 7 + d)
            if day > today { continue }  // future days stay blank
            let rect = CGRect(x: CGFloat(w) * (sq + gap), y: CGFloat(d) * (sq + gap), width: sq, height: sq)
            let shape = Path(roundedRect: rect, cornerRadius: sq * 0.26)
            ctx.fill(shape, with: .color(.heat(counts[day] ?? 0)))
            if day == today {
              ctx.stroke(Path(roundedRect: rect.insetBy(dx: 0.75, dy: 0.75), cornerRadius: sq * 0.26), with: .color(.primary), lineWidth: 1.5)
            }
          }
        }
      }
      .aspectRatio((CGFloat(weeks) + CGFloat(weeks - 1) * gapRatio) / (7 + 6 * gapRatio), contentMode: .fit)
    }
  }
}
