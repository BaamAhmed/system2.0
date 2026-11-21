import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { syncWidgets, useToday } from '../store';

export default function RootLayout() {
  const scheme = useColorScheme();
  const today = useToday();
  // Refresh the widget snapshot on launch, on return to foreground and when the date changes.
  useEffect(syncWidgets, [today]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Matching the system theme stops Liquid Glass header buttons flickering in dark mode. */}
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="schedule"
            options={{ presentation: 'formSheet', sheetAllowedDetents: [0.8, 1], sheetGrabberVisible: true, headerShown: true, headerTransparent: true }}
          />
          <Stack.Screen
            name="task"
            options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true, headerShown: true, headerTransparent: true, title: 'Edit task' }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
