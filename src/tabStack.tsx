import { Stack } from 'expo-router';

/** Each tab is a native stack so it gets a large, collapsing title. */
export default function TabStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
      }}
    />
  );
}
