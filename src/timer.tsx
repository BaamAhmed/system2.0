import { useEffect, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  active, complete, dueLabel, extendTimer, formatClock, formatDuration, isTimeUp, pauseTimer, resumeTimer, startTimer,
  stopTimer, tagOf, taskFocusSeconds, TIMER_MAX, TIMER_MIN, TIMER_STEP, timerElapsed, timerRemaining, type Task,
} from './domain';
import { act, useAppState, useNow, useToday } from './store';
import { rounded } from './theme';
import { Icon, TagDot } from './ui';

// The panel is black in both modes, like the Dynamic Island it echoes.
const ink = { bg: '#000000', label: '#FFFFFF', sec: 'rgba(235,235,245,0.6)', fill: 'rgba(255,255,255,0.14)' };

/**
 * Countdown whose digits roll: each character has its own fixed-width slot, and a changed character
 * slides in from below while the old one leaves upward. Reanimated respects Reduce Motion here.
 */
export function RollingClock({ text, size, color = ink.label }: { text: string; size: number; color?: string }) {
  const style = [rounded, { fontSize: size, lineHeight: size * 1.08, fontWeight: '700' as const, color, fontVariant: ['tabular-nums' as const] }];
  return (
    <View style={{ flexDirection: 'row' }} accessible accessibilityLabel={text}>
      {text.split('').map((ch, i) => (
        <View key={`${text.length}-${i}`} style={{ overflow: 'hidden' }}>
          <Text style={[style, { opacity: 0 }]}>{ch === ':' ? ':' : '0'}</Text>
          <Animated.Text key={ch} entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(260)} style={[style, StyleSheet.absoluteFill, { textAlign: 'center' }]}>
            {ch}
          </Animated.Text>
        </View>
      ))}
    </View>
  );
}

const SPACING = 22; // px per 10 minutes

/** Horizontal tick ruler: one tick per 10 minutes, labelled on the hour; snaps and ticks haptically. */
function TickRuler({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const [width, setWidth] = useState(0);
  const last = useRef(value);
  const steps = (TIMER_MAX - TIMER_MIN) / TIMER_STEP;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(steps, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / SPACING)));
    const m = TIMER_MIN + i * TIMER_STEP;
    if (m !== last.current) {
      last.current = m;
      Haptics.selectionAsync();
      onChange(m);
    }
  };
  const fade = (side: 'left' | 'right') => (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 56, backgroundImage: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, #000000, #00000000)` }} />
  );
  return (
    <View style={{ height: 58 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="adjustable" accessibilityLabel="Timer length" accessibilityValue={{ text: formatMinutes(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(TIMER_MAX, Math.max(TIMER_MIN, value + (e.nativeEvent.actionName === 'increment' ? TIMER_STEP : -TIMER_STEP))))}
    >
      {width > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SPACING}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentOffset={{ x: ((value - TIMER_MIN) / TIMER_STEP) * SPACING, y: 0 }}
          contentContainerStyle={{ paddingHorizontal: width / 2 - SPACING / 2, alignItems: 'flex-end' }}
        >
          {Array.from({ length: steps + 1 }, (_, i) => {
            const m = TIMER_MIN + i * TIMER_STEP;
            const hour = m % 60 === 0;
            return (
              <View key={m} style={{ width: SPACING, alignItems: 'center' }}>
                <View style={{ width: 2, height: hour ? 26 : 16, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)', marginBottom: hour ? 4 : 8 }} />
                <Text style={[rounded, { height: 14, fontSize: 11, fontWeight: '600', color: ink.sec }]}>{hour ? `${m / 60}h` : ''}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
      {fade('left')}
      {fade('right')}
      <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - 2, bottom: 14, width: 4, height: 38, borderRadius: 2, backgroundColor: '#FF453A' }} />
    </View>
  );
}

const formatMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`);

/** The floating timer panel: start a timer, or control the running one. */
export function TimerPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const state = useAppState();
  const timer = state.timer;
  const now = useNow(visible && !!timer);
  // Swipe up to dismiss (vertical drags only, so the ruler keeps horizontal scrolling).
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => g.dy < -30 && onClose(),
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} onPress={onClose} accessibilityLabel="Close timer" />
      {visible && (
        <Animated.View entering={FadeInUp.springify().damping(18)} style={st.panel} {...swipe.panHandlers}>
          {!timer ? <StartPanel /> : isTimeUp(timer, now) ? <DonePanel now={now} onClose={onClose} /> : <RunningPanel now={now} />}
        </Animated.View>
      )}
    </Modal>
  );
}

function StartPanel() {
  const state = useAppState();
  const tasks = active(state);
  const [taskId, setTaskId] = useState(tasks[0]?.id);
  const [minutes, setMinutes] = useState(30);
  if (!tasks.length) return <Text style={[st.sec, { paddingVertical: 12 }]}>Schedule a task on Focus to start a timer.</Text>;

  const start = () => {
    if (taskId && !act((s) => startTimer(s, taskId, minutes))) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -22 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 22 }}>
        {tasks.map((t) => (
          <TaskChip key={t.id} task={t} selected={t.id === taskId} onPress={() => setTaskId(t.id)} />
        ))}
      </ScrollView>
      <Text style={[st.readout]} accessibilityRole="text">
        {minutes < 60 ? (
          <>{minutes}<Text style={st.unit}> min</Text></>
        ) : (
          <>{Math.floor(minutes / 60)}<Text style={st.unit}> hr</Text>{minutes % 60 ? <> {minutes % 60}<Text style={st.unit}> min</Text></> : null}</>
        )}
      </Text>
      <View style={{ marginTop: 6 }}>
        <TickRuler value={minutes} onChange={setMinutes} />
      </View>
      <Pressable onPress={start} style={({ pressed }) => [st.primary, { marginTop: 14 }, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Icon name="play.fill" size={15} color="#000" />
        <Text style={st.primaryText}>Start focus</Text>
      </Pressable>
    </View>
  );
}

function TaskChip({ task, selected, onPress }: { task: Task; selected: boolean; onPress: () => void }) {
  const tag = tagOf(useAppState(), task);
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={[st.chip, { backgroundColor: selected ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)' }, selected && { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)' }]}>
      <TagDot color={tag?.color ?? '#FFFFFF'} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? ink.label : ink.sec }} numberOfLines={1}>{task.title}</Text>
    </Pressable>
  );
}

/** Title (wraps), then "Tag · Due …". */
function TaskHeader({ task, right }: { task: Task; right?: React.ReactNode }) {
  const state = useAppState();
  const today = useToday();
  const tag = tagOf(state, task);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
          <View style={{ paddingTop: 7 }}><TagDot color={tag?.color ?? '#FFFFFF'} size={8} /></View>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 21, color: ink.label }}>{task.title}</Text>
        </View>
        {right}
      </View>
      <Text style={[st.sec, { marginLeft: 16, marginTop: 4 }]}>
        {tag ? `${tag.name} · ` : ''}{dueLabel(task.scheduledFor!, today)}
      </Text>
    </View>
  );
}

function RunningPanel({ now }: { now: Date }) {
  const state = useAppState();
  const t = state.timer!;
  const task = state.tasks.find((x) => x.id === t.taskId)!;
  const paused = !t.runStartedAt;
  const remaining = timerRemaining(t, now);
  const ends = new Date(now.getTime() + remaining * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const progress = Math.min(1, timerElapsed(t, now) / t.plannedSec);
  const toggle = () => {
    act((s) => (paused ? resumeTimer(s) : pauseTimer(s)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 6, paddingBottom: 2 }}>
      <TaskHeader task={task} right={<Text style={[st.sec, paused && { color: '#FF9F0A', fontWeight: '600' }]}>{paused ? 'Paused' : `Ends ${ends}`}</Text>} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
        <RollingClock text={formatClock(remaining)} size={54} color={paused ? ink.sec : ink.label} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <RoundButton icon={paused ? 'play.fill' : 'pause.fill'} light label={paused ? 'Resume' : 'Pause'} onPress={toggle} />
          <RoundButton icon="stop.fill" label="Stop" onPress={() => { act((s) => stopTimer(s)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} />
        </View>
      </View>
      <View style={st.track}><View style={[st.bar, { width: `${progress * 100}%` }]} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="clock" size={13} color={ink.sec} />
          <Text style={st.sec}>{formatDuration(taskFocusSeconds(state, task.id, now))} on this task</Text>
        </View>
        <Pressable onPress={() => act((s) => extendTimer(s))} style={st.pill} accessibilityRole="button">
          <Text style={{ fontSize: 13, fontWeight: '600', color: ink.label }}>+10 min</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DonePanel({ now, onClose }: { now: Date; onClose: () => void }) {
  const state = useAppState();
  const t = state.timer!;
  const task = state.tasks.find((x) => x.id === t.taskId)!;
  const tag = tagOf(state, task);
  // Buzz once when time runs out while the panel is open.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  const finish = (markDone: boolean) => {
    act((s) => (markDone ? complete(s, task.id, now) : stopTimer(s, now)));
    if (markDone) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TagDot color={tag?.color ?? '#FFFFFF'} size={8} />
        <Text style={st.sec} numberOfLines={2}>{task.title}</Text>
      </View>
      <Text style={{ fontSize: 30, fontWeight: '700', color: ink.label, marginTop: 10, letterSpacing: -0.3 }}>Time’s up</Text>
      <Text style={[st.sec, { fontSize: 15, marginTop: 2 }]}>
        {formatDuration(t.plannedSec)} focused, {formatDuration(taskFocusSeconds(state, task.id, now))} on this task so far
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <Pressable onPress={() => finish(true)} style={[st.primary, { flex: 1.4 }]} accessibilityRole="button">
          <Icon name="checkmark" size={15} color="#000" />
          <Text style={st.primaryText}>Mark complete</Text>
        </Pressable>
        <Pressable onPress={() => act((s) => extendTimer(s, 10, now))} style={[st.secondary, { flex: 1 }]} accessibilityRole="button">
          <Text style={st.secondaryText}>+10 min</Text>
        </Pressable>
        <Pressable onPress={() => finish(false)} style={[st.secondary, { flex: 0.8 }]} accessibilityRole="button">
          <Text style={st.secondaryText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RoundButton({ icon, light, label, onPress }: { icon: any; light?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.round, { backgroundColor: light ? '#FFFFFF' : 'rgba(255,255,255,0.16)' }, pressed && { opacity: 0.75 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={18} color={light ? '#000' : '#FFF'} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  panel: { position: 'absolute', top: 10, left: 10, right: 10, borderRadius: 44, backgroundColor: ink.bg, paddingHorizontal: 22, paddingVertical: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)', boxShadow: '0 18px 50px rgba(0,0,0,0.35)' },
  sec: { fontSize: 13, lineHeight: 18, color: ink.sec },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingHorizontal: 14, borderRadius: 17, maxWidth: 220 },
  readout: { ...rounded, textAlign: 'center', fontSize: 36, lineHeight: 40, fontWeight: '700', color: ink.label, marginTop: 16, letterSpacing: -0.5 },
  unit: { fontSize: 20, fontWeight: '600', color: ink.sec },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF' },
  primaryText: { fontSize: 16, fontWeight: '600', color: '#000' },
  secondary: { alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 24, backgroundColor: ink.fill },
  secondaryText: { fontSize: 16, fontWeight: '600', color: ink.label },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: ink.fill, marginTop: 18, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' },
  pill: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: ink.fill, justifyContent: 'center' },
});
