import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { HORIZON_MAX, HORIZON_MIN, parseBackup, serializeBackup, setHorizon, toDay } from '../../../domain';
import { act, getState, replaceState, useAppState } from '../../../store';
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
        <Row icon="square.and.arrow.up" label="Export backup" onPress={exportBackup} />
        <Row icon="square.and.arrow.down" label="Import backup" onPress={importBackup} first={false} />
      </Group>
      <Text style={st.foot}>Your tasks never leave this device. Export saves everything as a JSON file. Importing a file replaces all current tasks.</Text>

      <Group style={{ marginTop: 26 }}>
        <Row icon="info.circle" label="Version">
          <Text style={{ fontSize: 17, color: colors.secondary }}>{Constants.expoConfig?.version}</Text>
        </Row>
      </Group>
    </ScrollView>
  );
}

async function exportBackup() {
  try {
    const file = new File(Paths.cache, `system2-backup-${toDay(new Date())}.json`);
    if (file.exists) file.delete();
    file.create();
    await file.write(serializeBackup(getState()));
    await Share.share({ url: file.uri }); // share sheet: Save to Files, AirDrop, etc.
  } catch (e) {
    Alert.alert('Couldn’t export', e instanceof Error ? e.message : String(e));
  }
}

async function importBackup() {
  const pick = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (pick.canceled) return;
  let next;
  try {
    next = parseBackup(await new File(pick.assets[0].uri).text()); // validated before anything is replaced
  } catch (e) {
    Alert.alert('Couldn’t import', e instanceof Error ? e.message : String(e));
    return;
  }
  const n = next.tasks.length;
  Alert.alert('Replace all tasks?', `This replaces everything in the app with ${n} ${n === 1 ? 'task' : 'tasks'} from the backup.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Replace', style: 'destructive', onPress: () => replaceState(next) },
  ]);
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
