# system2.0

A personal, local-only task app for iPhone and iPad. Unlimited backlog, at most **3 active tasks** scheduled over the next few days, and home-screen widgets that keep your focus visible. No accounts, no sync, no network calls.

Built with Expo (SDK 58, TypeScript, Expo Router) plus a native WidgetKit extension in Swift/SwiftUI.

## Install on your iPhone or iPad

You need a Mac with **Xcode 26+**, **Node 22+** and **CocoaPods** (`brew install cocoapods`), plus a device on **iOS 17+** (the app itself runs on 16.4+, the widgets need 17).

### 1. Install dependencies

```sh
npm install
```

### 2. Pick your own identifiers

Bundle IDs and App Group IDs are unique across all Apple accounts, so replace `dev.system2.app` with something of your own, e.g. `com.yourname.system2`. Change it in **two** places:

- `app.json`: `ios.bundleIdentifier`, and the App Group under `ios.entitlements` → `com.apple.security.application-groups` (keep the form `group.<bundle id>.shared`).
- `targets/widget/Shared.swift`: `appGroup` must equal that same App Group string.

The widget's bundle ID (`<bundle id>.widget`) and its App Group entitlement are derived from `app.json` automatically.

Optional: add `"appleTeamId": "XXXXXXXXXX"` under `ios` in `app.json` so prebuild fills in your team for both targets (find the ID in Xcode → Settings → Accounts, or on developer.apple.com).

### 3. Generate the Xcode project

```sh
npx expo prebuild -p ios --clean
```

This creates `ios/` (git-ignored, never edit it by hand), installs pods, and adds the widget target from `targets/widget`. Re-run it whenever you change `app.json`, `targets/widget/expo-target.config.js`, or add a native dependency.

### 4. Sign both targets

```sh
xed ios
```

1. Xcode → **Settings → Accounts**: add your Apple ID if it isn't there.
2. Select the project in the sidebar, then for **each** target (`system20` and `widget`) open **Signing & Capabilities**:
   - Tick **Automatically manage signing**.
   - Choose your **Team**.
3. Still under Signing & Capabilities, check that **App Groups** shows your group (e.g. `group.com.yourname.system2.shared`) **ticked on both targets**. Prebuild writes the entitlement; Xcode registers the group with Apple the first time it signs. If the group shows in red, click the refresh button under the list, or untick and re-tick it.

### 5. Run on the device

1. Connect the device by cable and tap **Trust** on it.
2. On the device, turn on **Settings → Privacy & Security → Developer Mode** (it restarts).
3. In Xcode, pick your device in the toolbar.
4. So the app works without your Mac running a dev server, build Release: **Product → Scheme → Edit Scheme → Run → Build Configuration → Release**.
5. Press **Run** (⌘R).
6. Free accounts, first launch only: on the device, **Settings → General → VPN & Device Management** → your Apple ID → **Trust**.

Same thing from the terminal: `npx expo run:ios --device --configuration Release`.

### 6. Add the widgets

Long-press the home screen → **Edit** → **Add Widget** → **system2.0**. There's a **Focus** widget and an **Activity** widget, each in small, medium and large, plus extra large on iPad. Tapping a widget opens its tab.

## Free vs paid Apple developer accounts

| | Free (Personal Team) | Paid ($99/year) |
|---|---|---|
| App stops launching after | **7 days** — reconnect and press Run again to renew (your data stays as long as you don't delete the app) | 1 year |
| Sideloaded apps per device | 3 at a time | No practical limit |
| New App IDs | 10 per 7 days (this app uses 2: the app and its widget) | No practical limit |
| **App Groups** | **Not available**, so the app works but **widgets show no data** | Available, widgets work |

If Xcode refuses the App Groups capability on a free team, remove it from both targets to get the app itself installed; the app catches the failed widget write and carries on.

## Backups

Everything lives on the device. **Settings → Export backup** saves all tasks as a JSON file through the share sheet (Files, AirDrop…). **Import backup** validates the file, then replaces everything after you confirm. Export before deleting the app or moving to a new device.

## How it fits together

- `src/domain.ts`: every rule as pure functions (3-slot cap, scheduling horizon, completion, reordering, heatmap counts, streaks, the widget snapshot, backup parsing). The cap is enforced here, not just in the UI.
- `src/store.ts`: in-memory state saved as one JSON document in `expo-sqlite`'s key-value store. After each change it writes a compact snapshot to the App Group (UserDefaults suite, via `@bacons/apple-targets`' `ExtensionStorage`) and calls `WidgetCenter.reloadAllTimelines()`.
- `src/app/`: Expo Router screens. Native tabs (Focus, Backlog, Activity, Settings) and form sheets for scheduling and editing.
- `targets/widget/`: the SwiftUI widgets. They read the snapshot and recompute "Today"/overdue for each timeline entry; there's one entry at each upcoming midnight, so labels roll over even if the app isn't opened.

## Development

```sh
npm test            # domain unit tests (Node's built-in runner)
npm run typecheck   # TypeScript
npx expo start      # JS dev server for a Debug build already on the device
```

Not supported in Expo Go: it needs the native modules and widget extension of a development build.
