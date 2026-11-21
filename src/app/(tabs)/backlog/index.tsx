import { useRef, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LayoutAnimation, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import ReorderableList, { reorderItems, useReorderableDrag } from 'react-native-reorderable-list';
import { active, addTask, backlog, complete, deleteTask, FULL_MESSAGE, isOverdue, openSlots, recentlyCompleted, reorderBacklog, uncomplete, type Task } from '../../../domain';
import { act, useAppState, useToday } from '../../../store';
import { colors, rounded } from '../../../theme';
import { CheckButton, Icon, SlotMeter } from '../../../ui';

export default function Backlog() {
  const state = useAppState();
  const today = useToday();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const items = backlog(state);
  const activeTasks = active(state);
  const open = openSlots(state);
  const overdue = activeTasks.filter((t) => isOverdue(t, today)).length;
  const done = recentlyCompleted(state, today);

  return (
    <>
      <Stack.Screen options={{ title: 'Backlog' }} />
      <ReorderableList
        data={items}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <Row task={item} full={open === 0} />}
        onReorder={({ from, to }) => act((s) => reorderBacklog(s, reorderItems(items, from, to).map((t) => t.id)))}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, gap: 14, paddingBottom: 8 }}>
            {open === 0 ? (
              <View style={st.fullNote}>
                <SlotMeter overdue={overdue} used={activeTasks.length} width={54} height={5} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.label }}>All 3 slots are in use</Text>
                  <Text style={{ fontSize: 13, color: colors.secondary, marginTop: 1 }}>Finish or unschedule a task first.</Text>
                </View>
              </View>
            ) : (
              <View style={st.meterRow}>
                <SlotMeter overdue={overdue} used={activeTasks.length} />
                <Text style={st.meterText}>{open} {open === 1 ? 'slot' : 'slots'} open</Text>
              </View>
            )}
            <QuickAdd autoFocus={add === '1'} />
          </View>
        }
        ListEmptyComponent={done.length ? undefined : <Text style={st.empty}>Your backlog is empty. Add anything you might do later.</Text>}
        ListFooterComponent={done.length ? <View style={{ marginTop: items.length ? 0 : 8 }}>{done.map((t) => <DoneRow key={t.id} task={t} />)}</View> : undefined}
      />
    </>
  );
}

function QuickAdd({ autoFocus }: { autoFocus: boolean }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const submit = () => {
    if (text.trim() && !act((s) => addTask(s, text))) setText('');
  };
  const focus = (on: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFocused(on);
  };
  return (
    <GlassView isInteractive style={[st.quick, focused && st.quickOpen, !isLiquidGlassAvailable() && { backgroundColor: colors.surface }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="New task"
        placeholderTextColor={colors.tertiary}
        multiline // wraps long titles; Return still adds the task
        returnKeyType="done"
        submitBehavior="submit" // keep the keyboard up for adding several in a row
        onSubmitEditing={submit}
        onFocus={() => focus(true)}
        onBlur={() => focus(false)}
        autoFocus={autoFocus}
        style={[st.quickInput, focused && { minHeight: 66 }]}
        accessibilityLabel="New task"
      />
      <Pressable onPress={submit} disabled={!text.trim()} style={[st.quickBtn, { backgroundColor: text.trim() ? colors.label : colors.fill }]} accessibilityLabel="Add task">
        <Icon name="arrow.up" size={15} color={text.trim() ? colors.onLabel : colors.secondary} />
      </Pressable>
    </GlassView>
  );
}

/** A task finished in the last 7 days: dimmed and struck through; tapping the check undoes it. */
function DoneRow({ task }: { task: Task }) {
  const undo = () => {
    if (!act((s) => uncomplete(s, task.id))) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  return (
    <View style={st.row}>
      <Pressable onPress={undo} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Mark ${task.title} as not done`}>
        <Icon name="checkmark.circle.fill" size={26} color={colors.tertiary} />
      </Pressable>
      <View style={st.rowBody}>
        <Text style={[st.rowTitle, st.doneTitle]}>{task.title}</Text>
      </View>
    </View>
  );
}

function Row({ task, full }: { task: Task; full: boolean }) {
  const drag = useReorderableDrag();
  const swipe = useRef<SwipeableMethods>(null);
  const run = (fn: () => void) => {
    swipe.current?.close();
    fn();
  };
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <View style={st.actions}>
          {/* Hard block: disabled when all slots are used (the header explains why). */}
          <Pressable
            disabled={full}
            onPress={() => run(() => router.push({ pathname: '/schedule', params: { id: task.id } }))}
            style={[st.action, { backgroundColor: full ? colors.fill : colors.label }]}
            accessibilityLabel={full ? `Schedule unavailable. ${FULL_MESSAGE}` : `Schedule ${task.title}`}
            accessibilityState={{ disabled: full }}
          >
            <Icon name="calendar" color={full ? colors.tertiary : colors.onLabel} />
          </Pressable>
          <Pressable onPress={() => run(() => act((s) => deleteTask(s, task.id)))} style={[st.action, { backgroundColor: colors.red }]} accessibilityLabel={`Delete ${task.title}`}>
            <Icon name="trash" color="#fff" />
          </Pressable>
        </View>
      )}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/task', params: { id: task.id } })}
        onLongPress={drag}
        delayLongPress={250}
        style={st.row}
        accessibilityHint="Long press to reorder"
      >
        <CheckButton
          label={task.title}
          onPress={() => {
            if (!act((s) => complete(s, task.id))) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
        <View style={st.rowBody}>
          <Text style={st.rowTitle}>{task.title}</Text>
          {task.notes ? <Text style={st.rowNotes} numberOfLines={2}>{task.notes}</Text> : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const st = StyleSheet.create({
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 4 },
  meterText: { ...rounded, fontSize: 15, fontWeight: '600', color: colors.secondary },
  fullNote: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 20, padding: 14, paddingHorizontal: 16 },
  quick: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderRadius: 25, paddingLeft: 20, paddingRight: 7 },
  quickOpen: { alignItems: 'flex-end', borderRadius: 22, paddingTop: 10, paddingBottom: 7 },
  quickInput: { flex: 1, fontSize: 17, lineHeight: 22, color: colors.label, paddingTop: 0, paddingBottom: 0, marginVertical: 7 },
  quickBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 20, backgroundColor: colors.bg },
  rowBody: { flex: 1, minHeight: 56, paddingVertical: 14, paddingRight: 20, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  rowTitle: { fontSize: 17, lineHeight: 22, color: colors.label },
  doneTitle: { color: colors.tertiary, textDecorationLine: 'line-through' },
  rowNotes: { fontSize: 15, lineHeight: 19, color: colors.secondary, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  action: { width: 52, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 15, color: colors.secondary, textAlign: 'center', paddingHorizontal: 40, paddingTop: 60 },
});
