// WidgetKit extension. `npx expo prebuild` (via @bacons/apple-targets) links every file in
// this folder into an Xcode widget target, so nothing in /ios needs editing by hand.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'widget',
  displayName: 'system2.0',
  deploymentTarget: '17.0', // containerBackground and Canvas-in-widgets need iOS 17
  entitlements: {
    // Same App Group as the app (app.json), so the widget can read the snapshot the app writes.
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
