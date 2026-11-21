import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { editTask } from '../domain';
import { act, useAppState } from '../store';
import { colors } from '../theme';

export default function TaskSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useAppState().tasks.find((t) => t.id === id);
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  if (!task) return null;

  const save = () => {
    if (!act((s) => editTask(s, task.id, { title, notes }))) router.back();
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
    </ScrollView>
  );
}

const st = StyleSheet.create({
  field: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 18, color: colors.label },
  title: { fontSize: 20, fontWeight: '600', height: 56 },
  notes: { fontSize: 17, minHeight: 120, paddingTop: 16, paddingBottom: 16, textAlignVertical: 'top' },
});
