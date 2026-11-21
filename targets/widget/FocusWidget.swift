import SwiftUI
import WidgetKit

/// Active tasks in date order with readable dates. No calendar: order + date is what matters.
struct FocusWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FocusWidget", provider: Provider()) { entry in
      FocusView(entry: entry)
        .containerBackground(Color.widgetBackground, for: .widget)
        .widgetURL(URL(string: "system2://focus"))
    }
    .configurationDisplayName("Focus")
    .description("Your scheduled tasks and open slots.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
  }
}

struct FocusView: View {
  let entry: Entry
  @Environment(\.widgetFamily) private var family

  private var tasks: [Snapshot.Task] { entry.tasks }
  private var red: Color { Color(UIColor.systemRed) }
  private func whenColor(_ t: Snapshot.Task) -> Color { entry.isOverdue(t) ? red : .secondary }
  private var openText: String { entry.openSlots == 1 ? "1 slot open" : "\(entry.openSlots) slots open" }

  var body: some View {
    switch family {
    case .systemSmall: tasks.isEmpty ? AnyView(emptySmall) : AnyView(small)
    case .systemMedium: AnyView(medium)
    case .systemLarge: AnyView(large)
    default: AnyView(extraLarge)
    }
  }

  // MARK: small

  private var small: some View {
    VStack(alignment: .leading, spacing: 8) {
      SlotMeter(entry: entry)
      ForEach(tasks, id: \.self) { t in
        VStack(alignment: .leading, spacing: 2) {
          Text(t.title).font(.system(size: 15, weight: .semibold)).lineLimit(tasks.count > 2 ? 1 : 2)
          Text(Day.short(t.scheduledFor, today: entry.today)).font(.system(size: 12, weight: .medium)).foregroundStyle(whenColor(t))
        }
      }
      Spacer(minLength: 0)
      if entry.openSlots > 0 {
        Text(openText).font(.system(size: 12, weight: .medium)).foregroundStyle(.tertiary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var emptySmall: some View {
    VStack(alignment: .leading) {
      SlotMeter(entry: entry)
      Spacer()
      Text("3").font(.system(size: 40, weight: .bold)).roundedNumbers()
      Text("slots open").font(.system(size: 15, weight: .semibold))
      Text("Pick tasks from your backlog").font(.system(size: 12)).foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // MARK: medium — a short timeline

  private var medium: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        SlotMeter(entry: entry, width: 96)
        Spacer()
        Text(entry.openSlots == 0 ? "All slots in use" : openText).font(.system(size: 13, weight: .semibold)).roundedNumbers().foregroundStyle(.secondary)
      }
      Spacer(minLength: 8)
      VStack(alignment: .leading, spacing: 14) {
        ForEach(0..<maxActive, id: \.self) { i in
          if i < tasks.count {
            timelineRow(dot: entry.isOverdue(tasks[i]) ? red : .primary, title: tasks[i].title,
                        when: Day.short(tasks[i].scheduledFor, today: entry.today).replacingOccurrences(of: "Overdue since ", with: "Overdue, "),
                        whenColor: whenColor(tasks[i]))
          } else {
            timelineRow(dot: nil, title: "Open slot", when: "", whenColor: .secondary)
          }
        }
      }
      .background(alignment: .leading) {
        Rectangle().fill(.separator).frame(width: 1).padding(.vertical, 6).padding(.leading, 3.5)
      }
    }
  }

  private func timelineRow(dot: Color?, title: String, when: String, whenColor: Color) -> some View {
    HStack(spacing: 12) {
      Group {
        if let dot { Circle().fill(dot) } else { Circle().strokeBorder(.tertiary, style: StrokeStyle(lineWidth: 1.5, dash: [2, 2])) }
      }
      .frame(width: 8, height: 8)
      Text(title).font(.system(size: 15, weight: dot == nil ? .medium : .semibold)).lineLimit(1)
        .foregroundStyle(dot == nil ? .tertiary : .primary)
      Spacer(minLength: 8)
      Text(when).font(.system(size: 13, weight: .medium)).foregroundStyle(whenColor).lineLimit(1)
    }
  }

  // MARK: large — three numbered slots

  private var large: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text("Focus").font(.system(size: 17, weight: .bold))
        Spacer()
        SlotMeter(entry: entry, width: 96)
      }
      .padding(.bottom, 14)
      ForEach(0..<maxActive, id: \.self) { i in
        if i > 0 { Divider() }
        HStack(alignment: .top, spacing: 14) {
          Text("\(i + 1)").font(.system(size: 13, weight: .semibold)).roundedNumbers().foregroundStyle(.tertiary).frame(width: 10)
          slotText(i < tasks.count ? tasks[i] : nil, titleSize: 22)
          Spacer(minLength: 0)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .padding(.vertical, 12)
      }
    }
  }

  // MARK: extra large (iPad) — slots side by side, in order left to right

  private var extraLarge: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Text("Focus").font(.system(size: 17, weight: .bold))
        Spacer()
        Text(openText).font(.system(size: 13, weight: .semibold)).roundedNumbers().foregroundStyle(.secondary)
        SlotMeter(entry: entry, width: 96)
      }
      HStack(spacing: 12) {
        ForEach(0..<maxActive, id: \.self) { i in
          let t = i < tasks.count ? tasks[i] : nil
          slotText(t, titleSize: 22)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(16)
            .background {
              if t != nil {
                RoundedRectangle(cornerRadius: 20).fill(Color(UIColor.secondarySystemFill).opacity(0.5))
              } else {
                RoundedRectangle(cornerRadius: 20).strokeBorder(.tertiary, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
              }
            }
        }
      }
    }
  }

  @ViewBuilder
  private func slotText(_ t: Snapshot.Task?, titleSize: CGFloat) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      if let t {
        Text(Day.long(t.scheduledFor, today: entry.today)).font(.system(size: 13, weight: .semibold)).foregroundStyle(whenColor(t))
        Text(t.title).font(.system(size: titleSize, weight: .semibold)).lineLimit(2)
        Spacer(minLength: 0)
        Text(Day.format(t.scheduledFor, "EEEMMMd")).font(.system(size: 13)).foregroundStyle(.secondary)
      } else {
        Text("Open slot").font(.system(size: 13, weight: .semibold)).foregroundStyle(.tertiary)
        Text("Choose from backlog").font(.system(size: titleSize, weight: .semibold)).foregroundStyle(.tertiary).lineLimit(2)
        Spacer(minLength: 0)
      }
    }
  }
}
