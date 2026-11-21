import SwiftUI
import WidgetKit

// The App Group in app.json is "group.<app bundle id>.shared" and this extension's bundle id is
// "<app bundle id>.widget", so the group is derived here instead of being hard-coded twice.
let appGroup: String = {
  let appBundleId = (Bundle.main.bundleIdentifier ?? "").split(separator: ".").dropLast().joined(separator: ".")
  return "group.\(appBundleId).shared"
}()
let maxActive = 3

/// The JSON the app writes to the App Group after every change (see buildSnapshot in src/domain.ts).
struct Snapshot: Decodable {
  struct Task: Decodable, Hashable {
    let title: String
    let scheduledFor: String  // "YYYY-MM-DD"
    let overdue: Bool  // as of `today`; widgets recompute it per entry date
    var color: String? = nil  // tag color "#RRGGBB"; nil = untagged

    /// The task's dot: its tag color, or the plain primary color (white in dark mode) when untagged.
    var dot: Color { color.flatMap(Color.init(hex:)) ?? .primary }
  }
  let today: String
  let openSlots: Int
  let active: [Task]
  let counts: [String: Int]
  let bestStreak: Int
  // Optional so snapshots written before focus widgets existed still decode.
  var focus: [String: Double]? = nil
  var focusTags: [FocusTag]? = nil

  struct FocusTag: Decodable, Hashable {
    let name: String
    var color: String? = nil
    let seconds: Double
  }

  static let empty = Snapshot(today: "", openSlots: maxActive, active: [], counts: [:], bestStreak: 0)

  static func load() -> Snapshot {
    guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "snapshot"),
      let snap = try? JSONDecoder().decode(Snapshot.self, from: Data(json.utf8))
    else { return .empty }
    return snap
  }

  /// Fake data for the widget gallery.
  static var sample: Snapshot {
    let today = Day.key(.now)
    var counts: [String: Int] = [:]
    for i in 0..<365 where (i * 7 + i / 3) % 5 != 0 { counts[Day.add(today, -i)] = (i * 13) % 4 + 1 }
    return Snapshot(
      today: today, openSlots: 1,
      active: [
        .init(title: "Renew passport photos", scheduledFor: Day.add(today, -2), overdue: true, color: "#FE7802"),
        .init(title: "Draft Q1 plan", scheduledFor: today, overdue: false, color: "#4FAAFE"),
      ],
      counts: counts, bestStreak: 14,
      focus: Dictionary(uniqueKeysWithValues: [35, 80, 0, 50, 95, 120, 60, 45, 70, 30, 110, 85, 40, 80].enumerated().map {
        (Day.add(today, $0.offset - 13), Double($0.element * 60))
      }),
      focusTags: [
        .init(name: "Work", color: "#4FAAFE", seconds: 11400), .init(name: "Reading", color: "#A292FE", seconds: 7500),
        .init(name: "Errands", color: "#FE7802", seconds: 4500), .init(name: "Home", color: "#4EC14A", seconds: 3000),
      ])
  }
}

// MARK: - Days ("YYYY-MM-DD" in the local calendar, same as the app)

enum Day {
  static let cal = Calendar.current

  static func key(_ date: Date) -> String {
    let c = cal.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
  }
  static func date(_ day: String) -> Date {
    let p = day.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return .now }
    return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) ?? .now
  }
  static func add(_ day: String, _ n: Int) -> String { key(cal.date(byAdding: .day, value: n, to: date(day))!) }
  static func between(_ a: String, _ b: String) -> Int { cal.dateComponents([.day], from: date(a), to: date(b)).day ?? 0 }
  /// 0 = Monday … 6 = Sunday
  static func mondayIndex(_ day: String) -> Int { (cal.component(.weekday, from: date(day)) + 5) % 7 }
  static func weekStart(_ day: String) -> String { add(day, -mondayIndex(day)) }

  static func format(_ day: String, _ pattern: String) -> String {
    let f = DateFormatter()
    f.setLocalizedDateFormatFromTemplate(pattern)
    return f.string(from: date(day))
  }

  /// Mirrors dayLabel() in src/domain.ts: "Today", "Tomorrow", "Mon 23", "Dec 4", "Overdue since Thu".
  static func short(_ day: String, today: String) -> String {
    let n = between(today, day)
    if n < 0 { return "Overdue since " + (n >= -6 ? format(day, "EEE") : format(day, "MMMd")) }
    if n == 0 { return "Today" }
    if n == 1 { return "Tomorrow" }
    return n < 7 ? format(day, "EEEd") : format(day, "MMMd")
  }
  /// "Overdue since Thursday", "Today", "Tomorrow", "Monday", "Dec 4"
  static func long(_ day: String, today: String) -> String {
    let n = between(today, day)
    if n < 0 { return "Overdue since " + (n >= -6 ? format(day, "EEEE") : format(day, "MMMd")) }
    if n == 0 { return "Today" }
    if n == 1 { return "Tomorrow" }
    return n < 7 ? format(day, "EEEE") : format(day, "MMMd")
  }
}

// MARK: - Timeline

struct Entry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot
  var today: String { Day.key(date) }
  var tasks: [Snapshot.Task] { snapshot.active.sorted { $0.scheduledFor < $1.scheduledFor } }
  func isOverdue(_ t: Snapshot.Task) -> Bool { t.scheduledFor < today }
  var openSlots: Int { max(0, maxActive - snapshot.active.count) }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: .now, snapshot: .sample) }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: .now, snapshot: context.isPreview ? .sample : .load()))
  }

  // The app reloads timelines after every change. On top of that, one entry per upcoming
  // midnight lets "Today"/"Tomorrow" and overdue states roll over without the app running.
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let snap = Snapshot.load()
    let midnight = Day.cal.startOfDay(for: .now)
    let entries = [Entry(date: .now, snapshot: snap)]
      + (1...3).map { Entry(date: Day.cal.date(byAdding: .day, value: $0, to: midnight)!, snapshot: snap) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

// MARK: - Shared views

extension Color {
  init?(hex: String) {
    guard hex.count == 7, hex.hasPrefix("#"), let v = UInt32(hex.dropFirst(), radix: 16) else { return nil }
    self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
  }
  static let widgetBackground = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.11, green: 0.11, blue: 0.118, alpha: 1) : .white })
  static let emptyFill = Color(UIColor.tertiarySystemFill)
  static func heat(_ count: Int) -> Color {
    count <= 0 ? .emptyFill : Color(UIColor.systemRed).opacity([0.28, 0.5, 0.75, 1][min(count, 4) - 1])
  }
}

/// The 3-segment slot meter: filled = task, red = overdue, empty = open.
struct SlotMeter: View {
  let entry: Entry
  var width: CGFloat? = nil
  var height: CGFloat = 5

  var body: some View {
    let tasks = entry.tasks
    HStack(spacing: 4) {
      ForEach(0..<maxActive, id: \.self) { i in
        Capsule()
          .fill(i < tasks.count ? (entry.isOverdue(tasks[i]) ? Color(UIColor.systemRed) : .primary) : .emptyFill)
          .frame(height: height)
      }
    }
    .frame(width: width)
  }
}

extension View {
  func roundedNumbers() -> some View { fontDesign(.rounded) }
}
