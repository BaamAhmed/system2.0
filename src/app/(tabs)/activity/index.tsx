import { useState } from 'react';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  addDays, averageSession, bestStreak, completionsByDay, currentStreak, focusByDay, focusByTag, focusByTimeOfDay, focusLevel,
  formatDuration, fromDay, onTimeRate, perActiveDay, perFinishedTask, sumRange, thisWeek, TIMES_OF_DAY, weekdayAverages, weekStart,
} from '../../../domain';
import { useAppState, useToday } from '../../../store';
import { colors, heat, rounded } from '../../../theme';
import { Card, HeatGrid, Legend, WeekBars, s as ui } from '../../../ui';

const WEEKS = 17; // ~4 months fits the phone width with comfortably large squares
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Activity() {
  const state = useAppState();
  const { tasks } = state;
  const today = useToday();
  const [mode, setMode] = useState<'tasks' | 'focus'>('tasks');
  const focus = focusByDay(state.sessions, today, 371);
  const focusTotal = sumRange(focus, addDays(weekStart(today), -(WEEKS - 1) * 7), today);
  const counts = completionsByDay(tasks, today, 371);
  const windowStart = addDays(weekStart(today), -(WEEKS - 1) * 7);
  const windowTotal = sumRange(counts, windowStart, today);
  const streak = currentStreak(counts, today);
  const best = Math.max(bestStreak(counts), streak);
  const onTime = onTimeRate(tasks);
  const week = thisWeek(counts, today);
  const lastWeek = sumRange(counts, addDays(weekStart(today), -7), addDays(weekStart(today), -1));
  const weekTotal = week.reduce<number>((a, v) => a + (v ?? 0), 0);
  const avgs = weekdayAverages(counts, today);
  const maxAvg = Math.max(...avgs);
  const bestDay = maxAvg > 0 ? avgs.indexOf(maxAvg) : -1;
  const todayIndex = (fromDay(today).getDay() + 6) % 7;
  const diff = weekTotal - lastWeek;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'Activity' }} />

      <Card style={{ marginHorizontal: 16, marginTop: 8, borderRadius: 30, padding: 18, paddingTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={[ui.num, { fontSize: 40, lineHeight: 44 }]}>{mode === 'tasks' ? windowTotal : formatDuration(focusTotal)}</Text>
            <Text style={ui.secondary}>{mode === 'tasks' ? 'completed in 4 months' : 'focused in 4 months'}</Text>
          </View>
          <Segmented value={mode} onChange={setMode} />
        </View>
        <View style={{ marginTop: 18 }}>
          {mode === 'tasks' ? (
            <HeatGrid counts={counts} today={today} weeks={WEEKS} months dayLabels />
          ) : (
            <HeatGrid counts={focus} today={today} weeks={WEEKS} months dayLabels level={focusLevel} />
          )}
        </View>
        <View style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <Legend />
        </View>
      </Card>

      <View style={st.section}>
        <View style={st.between}>
          <Text style={{ color: colors.label }}>
            <Text style={[ui.num, { fontSize: 34 }]}>{streak}</Text>
            <Text style={{ fontSize: 17, fontWeight: '600' }}> day streak</Text>
          </Text>
          <Text style={ui.secondary}>
            Best <Text style={[rounded, { fontWeight: '600', color: colors.label }]}>{best}</Text>
          </Text>
        </View>
        {best > 0 && (
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
            {Array.from({ length: Math.min(best, 30) }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < streak ? colors.red : colors.fill }} />
            ))}
          </View>
        )}
        <Text style={[ui.footnote, { marginTop: 8 }]}>
          {streak === 0 ? 'Finish a task today to start a streak.' : streak >= best ? 'This is your best streak yet.' : `${best - streak + 1} more days to set a new best.`}
        </Text>
      </View>

      <Card style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 28, borderRadius: 24 }}>
        <View style={st.stat}>
          <Text style={[ui.num, { fontSize: 28 }]}>{onTime === null ? '–' : `${Math.round(onTime * 100)}%`}</Text>
          <Text style={st.statLabel}>done by their scheduled day</Text>
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: 16 }} />
        <View style={st.stat}>
          <Text style={[ui.num, { fontSize: 28 }]}>{perActiveDay(counts).toFixed(1)}</Text>
          <Text style={st.statLabel}>a day, on days you finish something</Text>
        </View>
      </Card>

      <View style={[st.section, { marginTop: 34 }]}>
        <View style={st.between}>
          <Text style={ui.h2}>This week</Text>
          <Text style={ui.secondary}>
            <Text style={[rounded, { fontWeight: '600', color: colors.label }]}>{weekTotal}</Text> done
            {diff === 0 ? ', same as last week' : `, ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week`}
          </Text>
        </View>
        <View style={{ marginTop: 16 }}>
          <WeekBars values={week} todayIndex={todayIndex} />
        </View>
      </View>

      <View style={[st.section, { marginTop: 34 }]}>
        <Text style={ui.h2}>By weekday</Text>
        <Text style={[ui.secondary, { marginTop: 3, marginBottom: 12 }]}>
          {bestDay < 0 ? 'Finish a few tasks to see your strongest day.' : `You finish the most on ${WEEKDAYS[bestDay]}s.`}
        </Text>
        {avgs.map((v, i) => (
          <View key={i} style={st.wdRow}>
            <Text style={[st.wdLabel, i === bestDay && { color: colors.label, fontWeight: '700' }]}>{WEEKDAYS[i].slice(0, 3)}</Text>
            <View style={st.wdTrack}>
              <View style={{ width: `${maxAvg ? (v / maxAvg) * 100 : 0}%`, height: '100%', borderRadius: 5, backgroundColor: i === bestDay ? colors.red : heat(2) }} />
            </View>
            <Text style={st.wdValue}>{v.toFixed(1)}</Text>
          </View>
        ))}
      </View>
      <FocusTime />
    </ScrollView>
  );
}

function Segmented({ value, onChange }: { value: 'tasks' | 'focus'; onChange: (v: 'tasks' | 'focus') => void }) {
  return (
    <View style={st.seg} accessibilityRole="tablist">
      {(['tasks', 'focus'] as const).map((v) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[st.segItem, value === v && st.segOn]} accessibilityRole="tab" accessibilityState={{ selected: value === v }}>
          <Text style={{ fontSize: 13, fontWeight: value === v ? '600' : '500', color: value === v ? colors.label : colors.secondary }}>{v === 'tasks' ? 'Tasks' : 'Focus'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Where the focus timer's tracked time goes. */
function FocusTime() {
  const state = useAppState();
  const today = useToday();
  if (!state.sessions.length) {
    return (
      <View style={[st.section, { marginTop: 34 }]}>
        <Text style={ui.h2}>Focus time</Text>
        <Text style={[ui.secondary, { marginTop: 3 }]}>Start a focus timer from the Focus tab to see where your time goes.</Text>
      </View>
    );
  }
  const byDay = focusByDay(state.sessions, today, 21);
  const mon = weekStart(today);
  const week = sumRange(byDay, mon, today);
  const last = sumRange(byDay, addDays(mon, -7), addDays(mon, -1));
  const diff = week - last;
  const byTag = focusByTag(state, today);
  const maxTag = Math.max(1, ...byTag.map((x) => x.seconds));
  const tod = focusByTimeOfDay(state.sessions, today);
  const maxTod = Math.max(...tod);
  const top = maxTod > 0 ? tod.indexOf(maxTod) : -1;
  const perTask = perFinishedTask(state);

  return (
    <>
      <View style={[st.section, { marginTop: 34 }]}>
        <Text style={ui.h2}>Focus time</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Text style={[ui.num, { fontSize: 34 }]}>{formatDuration(week)}</Text>
          <Text style={ui.secondary}>this week{diff === 0 ? ', same as last' : `, ${formatDuration(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than last`}</Text>
        </View>
      </View>

      <Card style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 18, borderRadius: 24 }}>
        <View style={st.stat}>
          <Text style={[ui.num, { fontSize: 28 }]}>{formatDuration(averageSession(state.sessions))}</Text>
          <Text style={st.statLabel}>average session</Text>
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: 16 }} />
        <View style={st.stat}>
          <Text style={[ui.num, { fontSize: 28 }]}>{perTask ? formatDuration(perTask) : '–'}</Text>
          <Text style={st.statLabel}>per finished task, on average</Text>
        </View>
      </Card>

      {byTag.length > 0 && (
        <View style={[st.section, { marginTop: 30 }]}>
          <Text style={st.h3}>Where your time goes</Text>
          <Text style={[ui.footnote, { marginTop: 2, marginBottom: 12 }]}>Focused time by tag, last 30 days</Text>
          {byTag.map(({ tagId, seconds }) => {
            const tag = tagId ? state.tags.find((g) => g.id === tagId) : undefined;
            const c = tag?.color ?? colors.tertiary;
            return (
              <View key={tagId ?? 'none'} style={st.wdRow}>
                <View style={{ width: 84, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} />
                  <Text style={{ flexShrink: 1, fontSize: 13, fontWeight: '500', color: colors.label }} numberOfLines={1}>{tag?.name ?? 'No tag'}</Text>
                </View>
                <View style={st.wdTrack}><View style={{ width: `${(seconds / maxTag) * 100}%`, height: '100%', borderRadius: 5, backgroundColor: c }} /></View>
                <Text style={[st.wdValue, { width: 52 }]}>{formatDuration(seconds)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {maxTod > 0 && (
        <View style={[st.section, { marginTop: 30 }]}>
          <Text style={st.h3}>When you focus</Text>
          <Text style={[ui.footnote, { marginTop: 2, marginBottom: 14 }]}>You do most of your focusing {['in the morning', 'in the afternoon', 'in the evening', 'at night'][top]}.</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', height: 84 }}>
            {tod.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View style={{ width: '100%', height: Math.max(4, (v / maxTod) * 56), borderRadius: 7, backgroundColor: i === top ? colors.red : heat(2) }} />
                <Text style={{ fontSize: 12, fontWeight: i === top ? '700' : '500', color: i === top ? colors.label : colors.secondary }}>{TIMES_OF_DAY[i]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  h3: { fontSize: 17, fontWeight: '600', color: colors.label },
  seg: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 10, padding: 2 },
  segItem: { height: 28, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.bg, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  section: { paddingHorizontal: 20, marginTop: 30 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  stat: { flex: 1, padding: 16, paddingHorizontal: 18 },
  statLabel: { fontSize: 13, lineHeight: 17, color: colors.secondary, marginTop: 2 },
  wdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 26 },
  wdLabel: { width: 34, fontSize: 13, fontWeight: '500', color: colors.secondary },
  wdTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.fill, overflow: 'hidden' },
  wdValue: { ...rounded, width: 28, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.secondary },
});
