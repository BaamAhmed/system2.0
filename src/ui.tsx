import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View, type ViewStyle } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { addDays, fromDay, heatLevel, MAX_ACTIVE, weekStart, type Tag } from './domain';
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

// ---------- tags ----------

export const TagDot = ({ color, size = 7 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
);

/** Small "● Name" line used on rows and cards. */
export const TagLine = ({ tag, dim }: { tag: Tag; dim?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: dim ? 0.5 : 1 }}>
    <TagDot color={tag.color} />
    <Text style={{ fontSize: 13, color: colors.secondary }} numberOfLines={1}>{tag.name}</Text>
  </View>
);

/** Subtle pill: tinted fill + dot + name; selected adds a ring in the tag color. */
export function TagPill({ tag, selected, onPress, label }: { tag?: Tag; selected?: boolean; onPress: () => void; label?: string }) {
  const c = tag?.color;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[s.pill, { backgroundColor: c ? c + (selected ? '3D' : '1F') : colors.fill }, selected && c ? { borderWidth: 1.5, borderColor: c } : null]}
    >
      {c && <TagDot color={c} />}
      <Text style={s.pillText}>{tag?.name ?? label}</Text>
    </Pressable>
  );
}

/**
 * Horizontally scrolling tag pills. The edges fade only while there's more to scroll that way.
 * `fade` is the color behind the row (gradients need a concrete color, not a dynamic one).
 */
export function TagRow({ tags, selected, onSelect, onNew, withNone, fade, inset = 0 }: {
  tags: Tag[]; selected: string | null; onSelect: (id: string | null) => void; onNew: () => void;
  withNone?: boolean; fade: { light: string; dark: string }; inset?: number;
}) {
  const dark = useColorScheme() === 'dark';
  const base = dark ? fade.dark : fade.light;
  const [edges, setEdges] = useState({ left: false, right: false });
  const [box, setBox] = useState({ w: 0, content: 0, x: 0 });
  const update = (next: Partial<typeof box>) => {
    const b = { ...box, ...next };
    setBox(b);
    setEdges({ left: b.x > 2, right: b.x + b.w < b.content - 2 });
  };
  const edge = (side: 'left' | 'right') => (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 36, backgroundImage: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, ${base}, ${base}00)` }}
    />
  );
  return (
    <View onLayout={(e) => update({ w: e.nativeEvent.layout.width })}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEventThrottle={16}
        onScroll={(e) => update({ x: e.nativeEvent.contentOffset.x })}
        onContentSizeChange={(w) => update({ content: w })}
        contentContainerStyle={{ gap: 8, paddingHorizontal: inset }}
      >
        {withNone && <TagPill label="None" selected={selected === null} onPress={() => onSelect(null)} />}
        {tags.map((t) => (
          <TagPill key={t.id} tag={t} selected={selected === t.id} onPress={() => onSelect(selected === t.id && !withNone ? null : t.id)} />
        ))}
        <Pressable onPress={onNew} style={[s.pill, s.newPill]} accessibilityRole="button" accessibilityLabel="New tag">
          <Icon name="plus" size={12} color={colors.secondary} />
          <Text style={[s.pillText, { color: colors.secondary }]}>New tag</Text>
        </Pressable>
      </ScrollView>
      {edges.left && edge('left')}
      {edges.right && edge('right')}
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
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15 },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.label },
  newPill: { gap: 4, paddingLeft: 9, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.separator },
});
