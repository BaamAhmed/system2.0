import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { openTaskCount } from '../../../domain';
import { useAppState } from '../../../store';
import { colors, rounded } from '../../../theme';
import { Icon, TagDot } from '../../../ui';

export default function Tags() {
  const state = useAppState();
  const edit = (id?: string) => router.push(id ? { pathname: '/tag', params: { id } } : '/tag');

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 48 }}>
      <Stack.Screen options={{ title: 'Tags' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="New tag" onPress={() => edit()} />
      </Stack.Toolbar>

      {state.tags.length > 0 ? (
        <View style={st.group}>
          {state.tags.map((t, i) => (
            <Pressable key={t.id} onPress={() => edit(t.id)} style={({ pressed }) => [st.row, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`Edit ${t.name}`}>
              <View style={st.iconSlot}><TagDot color={t.color} size={14} /></View>
              <View style={[st.rowBody, i > 0 && st.divider]}>
                <Text style={st.name} numberOfLines={1}>{t.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[rounded, { fontSize: 17, color: colors.secondary }]}>{openTaskCount(state, t.id)}</Text>
                  <Icon name="chevron.right" size={14} color={colors.tertiary} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={st.empty}>No tags yet. Tap + to create one.</Text>
      )}
      {state.tags.length > 0 && <Text style={st.foot}>Numbers are open tasks with each tag. Tap a tag to rename, recolor or delete it.</Text>}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  group: { marginHorizontal: 16, marginTop: 20, borderRadius: 26, overflow: 'hidden', backgroundColor: colors.group },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20 },
  iconSlot: { width: 24, alignItems: 'center', marginRight: 14 },
  rowBody: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16, gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  name: { flexShrink: 1, fontSize: 17, color: colors.label },
  foot: { fontSize: 13, lineHeight: 18, color: colors.secondary, paddingHorizontal: 36, paddingTop: 8 },
  empty: { fontSize: 15, color: colors.secondary, textAlign: 'center', paddingTop: 60, paddingHorizontal: 40 },
});
