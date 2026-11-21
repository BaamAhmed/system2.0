import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { HORIZON_MAX, HORIZON_MIN, setHorizon } from '../../../domain';
import { act, useAppState } from '../../../store';
import { colors, rounded } from '../../../theme';
import { Icon } from '../../../ui';

export default function Settings() {
  const { horizonDays } = useAppState();
  const step = (d: number) => act((s) => setHorizon(s, s.horizonDays + d));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'Settings' }} />

      <Group style={{ marginTop: 20 }}>
        <Row icon="calendar" label="Scheduling range">
          <Text style={[rounded, { fontSize: 17, color: colors.secondary }]}>{horizonDays} {horizonDays === 1 ? 'day' : 'days'}</Text>
          <View style={st.stepper}>
            <Pressable onPress={() => step(-1)} disabled={horizonDays <= HORIZON_MIN} style={st.stepBtn} accessibilityLabel="Fewer days">
              <Text style={[st.stepText, horizonDays <= HORIZON_MIN && { color: colors.tertiary }]}>−</Text>
            </Pressable>
            <View style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.separator }} />
            <Pressable onPress={() => step(1)} disabled={horizonDays >= HORIZON_MAX} style={st.stepBtn} accessibilityLabel="More days">
              <Text style={[st.stepText, horizonDays >= HORIZON_MAX && { color: colors.tertiary }]}>+</Text>
            </Pressable>
          </View>
        </Row>
      </Group>
      <Text style={st.foot}>How far ahead a task can be scheduled, counting from today.</Text>

      <Group style={{ marginTop: 26 }}>
        <Row icon="info.circle" label="Version">
          <Text style={{ fontSize: 17, color: colors.secondary }}>{Constants.expoConfig?.version}</Text>
        </Row>
      </Group>
    </ScrollView>
  );
}

const Group = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[{ marginHorizontal: 16, borderRadius: 26, overflow: 'hidden', backgroundColor: colors.group }, style]}>{children}</View>
);

/** Every row has an icon slot, so labels, icons and separators share one alignment. */
function Row({ icon, label, children, first = true, onPress, tint = colors.label }: {
  icon: SFSymbol; label: string; children?: React.ReactNode; first?: boolean; onPress?: () => void; tint?: any;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={st.iconSlot}><Icon name={icon} size={20} color={tint} /></View>
      <View style={[st.rowBody, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
        <Text style={{ fontSize: 17, color: tint }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20 },
  iconSlot: { width: 24, alignItems: 'center', marginRight: 14 },
  rowBody: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 17, height: 34, backgroundColor: colors.fill },
  stepBtn: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, color: colors.label },
  foot: { fontSize: 13, lineHeight: 18, color: colors.secondary, paddingHorizontal: 36, paddingTop: 8 },
});
