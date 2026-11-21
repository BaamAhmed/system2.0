import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScrollView, Text, useColorScheme, View } from 'react-native';
import { daysBetween, fromDay, lastSchedulableDay, schedule, scheduleError, toDay } from '../domain';
import { act, useAppState, useToday } from '../store';
import { colors } from '../theme';
import { s as ui } from '../ui';

const relative = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

export default function ScheduleSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useAppState();
  const today = useToday();
  const scheme = useColorScheme();
  const task = state.tasks.find((t) => t.id === id);
  const [day, setDay] = useState(() => (task?.scheduledFor && task.scheduledFor >= today ? task.scheduledFor : today));
  if (!task) return null;

  // Same check the data layer runs on save, so the button state can never disagree with it.
  const error = scheduleError(state, task.id, day, today);
  const confirm = () => {
    if (act((s) => schedule(s, task.id, day, today))) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
      <Stack.Screen options={{ title: task.scheduledFor ? 'Reschedule' : 'Schedule' }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Cancel" onPress={() => router.back()} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="checkmark" variant="prominent" tintColor={colors.label} disabled={!!error} accessibilityLabel="Save" onPress={confirm} />
      </Stack.Toolbar>

      <View style={{ paddingHorizontal: 6 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', letterSpacing: -0.5, lineHeight: 29, color: colors.label }}>{task.title}</Text>
        <Text style={[ui.secondary, { marginTop: 4 }]}>
          {fromDay(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, {relative(daysBetween(today, day))}
        </Text>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: 26, marginTop: 20, padding: 8 }}>
        <DateTimePicker
          mode="date"
          display="inline"
          value={fromDay(day)}
          minimumDate={fromDay(today)}
          maximumDate={fromDay(lastSchedulableDay(state, today))}
          onValueChange={(_, d) => setDay(toDay(d))}
          accentColor={scheme === 'dark' ? '#FFFFFF' : '#000000'}
        />
      </View>

      <Text style={[ui.footnote, { paddingHorizontal: 14, paddingTop: 12 }, error && { color: colors.red }]}>
        {error ?? `Days up to ${state.horizonDays} ${state.horizonDays === 1 ? 'day' : 'days'} ahead can be picked. Change the range in Settings.`}
      </Text>
    </ScrollView>
  );
}
