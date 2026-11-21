import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { addDays, fromDay, heatLevel, MAX_ACTIVE, weekStart } from './domain';
import { colors, heat, rounded } from './theme';

export const Icon = ({ name, color = colors.label, size = 20 }: { name: SFSymbol; color?: any; size?: number }) => (
  <SymbolView name={name} tintColor={color} size={size} />
);

/** The 3-segment slot meter: filled = task, red = overdue, empty = open. */
export function SlotMeter({ overdue, used, width = 108, height = 6 }: { overdue: number; used: number; width?: number; height?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, width }} accessibilityLabel={`${used} of ${MAX_ACTIVE} slots in use`}>
      {Array.from({ length: MAX_ACTIVE }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height, borderRadius: height, backgroundColor: i < overdue ? colors.red : i < used ? colors.label : colors.fill }}
        />
      ))}
    </View>
  );
}

/** Round completion button. */
export function CheckButton({ onPress, overdue, label }: { onPress: () => void; overdue?: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Complete ${label}`}>
      <Icon name="circle" size={26} color={overdue ? colors.red : colors.tertiary} />
    </Pressable>
  );
}

/** Primary capsule button (label-colored, like the design's black buttons). */
export function CapsuleButton({ title, icon, onPress }: { title: string; icon?: SFSymbol; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.capsule, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      {icon && <Icon name={icon} size={14} color={colors.onLabel} />}
      <Text style={s.capsuleText}>{title}</Text>
    </Pressable>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Heatmap whose squares are sized to exactly fill the available width.
 * Columns are weeks (Monday first); days after today stay blank; today is outlined.
 */
export function HeatGrid({ counts, today, weeks, gap = 3, months = false, dayLabels = false }: {
  counts: Record<string, number>; today: string; weeks: number; gap?: number; months?: boolean; dayLabels?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const labelW = dayLabels ? 16 : 0;
  const sq = width ? (width - labelW - (weeks - 1) * gap) / weeks : 0;
  const start = addDays(weekStart(today), -(weeks - 1) * 7);
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel="Completed tasks per day">
      {sq > 0 && (
        <>
          {months && (
            <View style={{ flexDirection: 'row', gap, height: 18, paddingLeft: labelW }}>
              {cols.map((days, w) => {
                const first = days.find((d) => d.endsWith('-01'));
                // skip the last two columns so a label never runs off the edge
                return (
                  <Text key={w} numberOfLines={1} style={[s.month, { width: sq, overflow: 'visible' }]}>
                    {first && w < weeks - 2 ? MONTHS[fromDay(first).getMonth()] : ''}
                  </Text>
                );
              })}
            </View>
          )}
          <View style={{ flexDirection: 'row' }}>
            {dayLabels && (
              <View style={{ width: labelW, gap }}>
                {['M', '', 'W', '', 'F', '', ''].map((l, i) => (
                  <Text key={i} style={[s.dayLabel, { height: sq, lineHeight: sq }]}>{l}</Text>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap }}>
              {cols.map((days, w) => (
                <View key={w} style={{ gap }}>
                  {days.map((day) => (
                    <View
                      key={day}
                      style={{
                        width: sq,
                        height: sq,
                        borderRadius: Math.max(2, sq * 0.26),
                        backgroundColor: day > today ? 'transparent' : heat(heatLevel(counts[day] ?? 0)),
                        ...(day === today ? { borderWidth: 1.5, borderColor: colors.label } : null),
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

export function Legend() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Text style={[s.legendText, { marginRight: 4 }]}>Less</Text>
      {[0, 1, 2, 3, 4].map((l) => (
        <View key={l} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: heat(l) }} />
      ))}
      <Text style={[s.legendText, { marginLeft: 4 }]}>More</Text>
    </View>
  );
}

/** Mon..Sun vertical bars; null = a day still ahead. */
export function WeekBars({ values, todayIndex, height = 96 }: { values: (number | null)[]; todayIndex: number; height?: number }) {
  const max = Math.max(4, ...values.map((v) => v ?? 0));
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', height: height + 22 }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: '100%',
              height: v === null ? 4 : Math.max(4, (v / max) * height),
              borderRadius: 7,
              backgroundColor: v === null ? colors.fill : i === todayIndex ? colors.red : heat(2),
            }}
          />
          <Text style={[s.barLabel, i === todayIndex && { color: colors.label, fontWeight: '700' }]}>{'MTWTFSS'[i]}</Text>
        </View>
      ))}
    </View>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ backgroundColor: colors.surface, borderRadius: 26 }, style]}>{children}</View>
);

export const s = StyleSheet.create({
  capsule: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingLeft: 13, paddingRight: 16, borderRadius: 19, backgroundColor: colors.label, alignSelf: 'flex-start' },
  capsuleText: { color: colors.onLabel, fontSize: 15, fontWeight: '600' },
  month: { fontSize: 11, fontWeight: '500', color: colors.secondary },
  dayLabel: { fontSize: 10, fontWeight: '500', color: colors.tertiary },
  legendText: { fontSize: 11, color: colors.secondary },
  barLabel: { fontSize: 12, fontWeight: '500', color: colors.secondary },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: colors.label },
  secondary: { fontSize: 15, color: colors.secondary },
  footnote: { fontSize: 13, lineHeight: 18, color: colors.secondary },
  num: { ...rounded, fontWeight: '700', color: colors.label },
});
