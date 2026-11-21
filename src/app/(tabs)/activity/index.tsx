import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  addDays, bestStreak, completionsByDay, currentStreak, fromDay, onTimeRate, perActiveDay,
  sumRange, thisWeek, weekdayAverages, weekStart,
} from '../../../domain';
import { useAppState, useToday } from '../../../store';
import { colors, heat, rounded } from '../../../theme';
import { Card, HeatGrid, Legend, WeekBars, s as ui } from '../../../ui';

const WEEKS = 17; // ~4 months fits the phone width with comfortably large squares
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Activity() {
  const { tasks } = useAppState();
  const today = useToday();
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
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={[ui.num, { fontSize: 40, lineHeight: 44 }]}>{windowTotal}</Text>
          <Text style={ui.secondary}>completed in the last 4 months</Text>
        </View>
        <View style={{ marginTop: 18 }}>
          <HeatGrid counts={counts} today={today} weeks={WEEKS} months dayLabels />
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
    </ScrollView>
  );
}

const st = StyleSheet.create({
  section: { paddingHorizontal: 20, marginTop: 30 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  stat: { flex: 1, padding: 16, paddingHorizontal: 18 },
  statLabel: { fontSize: 13, lineHeight: 17, color: colors.secondary, marginTop: 2 },
  wdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 26 },
  wdLabel: { width: 34, fontSize: 13, fontWeight: '500', color: colors.secondary },
  wdTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.fill, overflow: 'hidden' },
  wdValue: { ...rounded, width: 28, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.secondary },
});
