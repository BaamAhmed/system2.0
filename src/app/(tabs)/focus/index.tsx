import { useEffect, useState } from 'react';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { active, addDays, complete, dayLabel, fromDay, isOverdue, MAX_ACTIVE, tagOf, formatClock, formatDuration, taskFocusSeconds, timerRemaining, unschedule, type Task } from '../../../domain';
import { act, useAppState, useNow, useToday } from '../../../store';
import { TimerPanel } from '../../../timer';
import { colors, rounded } from '../../../theme';
import { CapsuleButton, CheckButton, Icon, SlotMeter, TagLine, s as ui } from '../../../ui';

const completeTask = (id: string) => {
  if (!act((s) => complete(s, id))) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
const openSchedule = (id: string) => router.push({ pathname: '/schedule', params: { id } });

export default function Focus() {
  const state = useAppState();
  const today = useToday();
  const tasks = active(state);
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const now = useNow(!!state.timer);
  const [timerOpen, setTimerOpen] = useState(false);
  // Tapping the Live Activity opens system2://focus?timer=1
  const { timer: openTimer } = useLocalSearchParams<{ timer?: string }>();
  useEffect(() => {
    if (openTimer) setTimerOpen(true);
  }, [openTimer]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={st.content}>
      <Stack.Screen options={{ title: 'Focus' }} />
      <TimerPanel visible={timerOpen} onClose={() => setTimerOpen(false)} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="timer"
          tintColor={state.timer ? colors.red : undefined}
          accessibilityLabel={state.timer ? 'Focus timer' : 'Start a focus timer'}
          onPress={() => setTimerOpen(true)}
        >
          {state.timer ? formatClock(timerRemaining(state.timer, now)) : undefined}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="Add a task" onPress={() => router.navigate({ pathname: '/backlog', params: { add: '1' } })} />
      </Stack.Toolbar>

      <View style={st.meterRow}>
        <SlotMeter overdue={overdue} used={tasks.length} />
        <Text style={st.meterText}>{tasks.length} of {MAX_ACTIVE} in use</Text>
      </View>

      <View style={{ gap: 10, marginTop: 20 }}>
        {tasks.map((t) => <SlotCard key={t.id} task={t} today={today} now={now} />)}
        {Array.from({ length: MAX_ACTIVE - tasks.length }, (_, i) => (
          <View key={i} style={st.openSlot}>
            <Text style={st.when}>Open slot</Text>
            <CapsuleButton title="Choose from backlog" icon="plus" onPress={() => router.navigate('/backlog')} />
          </View>
        ))}
      </View>

      <Text style={[ui.h2, { marginTop: 30, marginBottom: 4 }]}>Next 7 days</Text>
      <Rail tasks={tasks} today={today} />
    </ScrollView>
  );
}

function SlotCard({ task, today, now }: { task: Task; today: string; now: Date }) {
  const overdue = isOverdue(task, today);
  const state = useAppState();
  const tag = tagOf(state, task);
  const timing = state.timer?.taskId === task.id ? state.timer : null;
  const focused = taskFocusSeconds(state, task.id, now);
  return (
    // Tap reschedules; long press opens the native context menu.
    <Link href={{ pathname: '/schedule', params: { id: task.id } }} asChild>
      <Link.Trigger>
        <Pressable style={st.card}>
          <View style={st.cardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
              <Text style={[st.when, overdue && { color: colors.red, fontWeight: '600' }]}>{dayLabel(task.scheduledFor!, today)}</Text>
              {tag && <TagLine tag={tag} />}
            </View>
            <CheckButton overdue={overdue} label={task.title} onPress={() => completeTask(task.id)} />
          </View>
          <Text style={st.title}>{task.title}</Text>
          {timing ? (
            <View style={st.timeRow}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red }} />
              <Text style={[st.timeText, { color: colors.red, fontWeight: '600' }]}>{timing.runStartedAt ? `${formatClock(timerRemaining(timing, now))} left` : 'Paused'}</Text>
            </View>
          ) : focused > 0 ? (
            <View style={st.timeRow}>
              <Icon name="clock" size={13} color={colors.secondary} />
              <Text style={st.timeText}>{formatDuration(focused)} focused</Text>
            </View>
          ) : null}
        </Pressable>
      </Link.Trigger>
      <Link.Menu>
        <Link.MenuAction title="Mark complete" icon="checkmark.circle" onPress={() => completeTask(task.id)} />
        <Link.MenuAction title="Reschedule" icon="calendar" onPress={() => openSchedule(task.id)} />
        <Link.MenuAction title="Move to backlog" icon="tray.and.arrow.down" onPress={() => act((s) => unschedule(s, task.id))} />
      </Link.Menu>
    </Link>
  );
}

/** Next 7 days: which day each active task is due. Overdue tasks sit on today, in red. */
function Rail({ tasks, today }: { tasks: Task[]; today: string }) {
  return (
    <View style={{ flexDirection: 'row' }} accessibilityRole="summary">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(today, i);
        const marks = tasks.filter((t) => (i === 0 ? t.scheduledFor! <= day : t.scheduledFor === day));
        const isToday = i === 0;
        return (
          <View key={day} style={st.railCol}>
            <Text style={st.railWd}>{'SMTWTFS'[fromDay(day).getDay()]}</Text>
            <View style={[st.railNum, isToday && { backgroundColor: colors.label }]}>
              <Text style={[st.railNumText, isToday && { color: colors.onLabel, fontWeight: '700' }]}>{fromDay(day).getDate()}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 3, height: 4 }}>
              {marks.map((t) => (
                <View key={t.id} style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: isOverdue(t, today) ? colors.red : colors.label }} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 4 },
  meterText: { ...rounded, fontSize: 15, fontWeight: '600', color: colors.secondary },
  card: { backgroundColor: colors.surface, borderRadius: 26, padding: 18, paddingTop: 16, gap: 10, minHeight: 106 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  when: { fontSize: 15, fontWeight: '500', color: colors.secondary },
  title: { fontSize: 24, fontWeight: '600', lineHeight: 28, letterSpacing: -0.4, color: colors.label },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -2 },
  timeText: { ...rounded, fontSize: 13, color: colors.secondary },
  openSlot: { borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.tertiary, padding: 18, paddingTop: 16, gap: 12, minHeight: 106 },
  railCol: { flex: 1, alignItems: 'center', gap: 6 },
  railWd: { fontSize: 12, fontWeight: '500', color: colors.secondary },
  railNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  railNumText: { ...rounded, fontSize: 17, fontWeight: '500', color: colors.label },
});
