import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { editTask } from '../domain';
import { act, useAppState } from '../store';
import { colors } from '../theme';
import { TagRow } from '../ui';

export default function TaskSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, tags } = useAppState();
  const task = tasks.find((t) => t.id === id);
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [tagId, setTagId] = useState<string | null>(task?.tagId ?? null);
  if (!task) return null;

  const save = () => {
    if (!act((s) => editTask(s, task.id, { title, notes, tagId }))) router.back();
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Cancel" onPress={() => router.back()} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="checkmark" variant="prominent" tintColor={colors.label} disabled={!title.trim()} accessibilityLabel="Save" onPress={save} />
      </Stack.Toolbar>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.tertiary} style={[st.field, st.title]} autoFocus returnKeyType="done" onSubmitEditing={save} accessibilityLabel="Title" />
      <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={colors.tertiary} style={[st.field, st.notes]} multiline accessibilityLabel="Notes" />
      <Text style={st.label}>Tag</Text>
      <View style={{ marginHorizontal: -16 }}>
        <TagRow tags={tags} selected={tagId} onSelect={setTagId} withNone onNew={() => router.push('/tag')} fade={{ light: '#FFFFFF', dark: '#000000' }} inset={16} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  field: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 18, color: colors.label },
  title: { fontSize: 20, fontWeight: '600', height: 56 },
  label: { fontSize: 15, fontWeight: '600', color: colors.label, marginTop: 10, marginLeft: 6 },
  notes: { fontSize: 17, minHeight: 120, paddingTop: 16, paddingBottom: 16, textAlignVertical: 'top' },
});
