import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { addTag, deleteTag, editTag, openTaskCount, TAG_COLORS } from '../domain';
import { act, useAppState } from '../store';
import { colors } from '../theme';
import { TagDot } from '../ui';

/** Create (no id) or edit a tag: name, color, delete. */
export default function TagSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const state = useAppState();
  const tag = id ? state.tags.find((t) => t.id === id) : undefined;
  const firstUnused = TAG_COLORS.find((c) => !state.tags.some((t) => t.color === c)) ?? TAG_COLORS[0];
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? firstUnused);
  if (id && !tag) return null;

  const save = () => {
    const err = act((s) => (tag ? editTag(s, tag.id, { name, color }) : addTag(s, name, color)));
    if (err) Alert.alert('Couldn’t save tag', err);
    else router.back();
  };
  const remove = () => {
    if (!tag) return;
    const n = openTaskCount(state, tag.id);
    Alert.alert(`Delete “${tag.name}”?`, n ? `${n} open ${n === 1 ? 'task keeps' : 'tasks keep'} going, just without a tag.` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { act((s) => deleteTag(s, tag.id)); router.back(); } },
    ]);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: tag ? 'Edit tag' : 'New tag' }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Cancel" onPress={() => router.back()} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="checkmark" variant="prominent" tintColor={colors.label} disabled={!name.trim()} accessibilityLabel="Save" onPress={save} />
      </Stack.Toolbar>

      <View style={st.nameField}>
        <TagDot color={color} size={12} />
        <TextInput value={name} onChangeText={setName} placeholder="Tag name" placeholderTextColor={colors.tertiary} style={st.nameInput} autoFocus={!tag} returnKeyType="done" onSubmitEditing={save} accessibilityLabel="Tag name" />
      </View>

      <Text style={st.label}>Color</Text>
      <View style={st.grid}>
        {TAG_COLORS.map((c) => {
          const on = c === color;
          return (
            <Pressable key={c} onPress={() => setColor(c)} style={[st.swatchRing, on && { borderColor: colors.label }]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Color ${c}`}>
              <View style={[st.swatch, { backgroundColor: c }, on && { width: 32, height: 32 }]} />
            </Pressable>
          );
        })}
      </View>

      {tag && (
        <Pressable onPress={remove} style={({ pressed }) => [st.delete, pressed && { opacity: 0.6 }]} accessibilityRole="button">
          <Text style={{ fontSize: 17, color: colors.red }}>Delete tag</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  nameField: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, borderRadius: 20, paddingHorizontal: 18, backgroundColor: colors.surface },
  nameInput: { flex: 1, fontSize: 20, fontWeight: '600', color: colors.label },
  label: { fontSize: 15, fontWeight: '600', color: colors.label, marginTop: 24, marginBottom: 10, marginLeft: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, padding: 12, borderRadius: 24, backgroundColor: colors.surface },
  swatchRing: { width: '16.66%', aspectRatio: 1, maxWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 2.5, borderColor: 'transparent' },
  swatch: { width: 38, height: 38, borderRadius: 19 },
  delete: { marginTop: 24, height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
