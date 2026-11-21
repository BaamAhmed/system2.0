import { Link, router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { active, addDays, complete, dayLabel, fromDay, isOverdue, MAX_ACTIVE, unschedule, type Task } from '../../../domain';
import { act, useAppState, useToday } from '../../../store';
import { colors, rounded } from '../../../theme';
import { CapsuleButton, CheckButton, SlotMeter, s as ui } from '../../../ui';

const completeTask = (id: string) => {
  if (!act((s) => complete(s, id))) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
const openSchedule = (id: string) => router.push({ pathname: '/schedule', params: { id } });

export default function Focus() {
  const state = useAppState();
  const today = useToday();
  const tasks = active(state);
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={st.content}>
      <Stack.Screen options={{ title: 'Focus' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="Add a task" onPress={() => router.navigate({ pathname: '/backlog', params: { add: '1' } })} />
      </Stack.Toolbar>

      <View style={st.meterRow}>
        <SlotMeter overdue={overdue} used={tasks.length} />
        <Text style={st.meterText}>{tasks.length} of {MAX_ACTIVE} in use</Text>
      </View>

      <View style={{ gap: 10, marginTop: 20 }}>
        {tasks.map((t) => <SlotCard key={t.id} task={t} today={today} />)}
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

function SlotCard({ task, today }: { task: Task; today: string }) {
  const overdue = isOverdue(task, today);
  return (
    // Tap reschedules; long press opens the native context menu.
    <Link href={{ pathname: '/schedule', params: { id: task.id } }} asChild>
      <Link.Trigger>
        <Pressable style={st.card}>
          <View style={st.cardTop}>
            <Text style={[st.when, overdue && { color: colors.red, fontWeight: '600' }]}>{dayLabel(task.scheduledFor!, today)}</Text>
            <CheckButton overdue={overdue} label={task.title} onPress={() => completeTask(task.id)} />
          </View>
          <Text style={st.title}>{task.title}</Text>
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
  openSlot: { borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.tertiary, padding: 18, paddingTop: 16, gap: 12, minHeight: 106 },
  railCol: { flex: 1, alignItems: 'center', gap: 6 },
  railWd: { fontSize: 12, fontWeight: '500', color: colors.secondary },
  railNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  railNumText: { ...rounded, fontSize: 17, fontWeight: '500', color: colors.label },
});
