import SwiftUI
import WidgetKit

@main
struct System2Widgets: WidgetBundle {
  var body: some Widget {
    FocusWidget()
    ActivityWidget()
    FocusLiveActivity()
  }
}
