import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import { ExtensionStorage } from '@bacons/apple-targets';
import {
  buildSnapshot, dueLabel, initialState, parseBackup, parseTimer, serializeBackup, tagOf, taskFocusSeconds,
  timerRemaining, toDay, type State,
} from './domain';
import { endFocusActivity, startFocusActivity, updateFocusActivity, type FocusActivityState } from '../modules/focus-activity';

// The whole state is one JSON document in SQLite's key-value table: small, atomic writes, no schema.
const KEY = 'state';

// Single source of truth for the App Group id: app.json's entitlements (also mirrored to the widget target).
const APP_GROUP: string | undefined = Constants.expoConfig?.ios?.entitlements?.['com.apple.security.application-groups']?.[0];
const shared = APP_GROUP ? new ExtensionStorage(APP_GROUP) : null;

function load(): State {
  const raw = Storage.getItemSync(KEY);
  if (!raw) return initialState;
  try {
    return parseBackup(raw);
  } catch {
    // Never overwrite data we couldn't read: park it under another key and start fresh.
    Storage.setItemSync(`${KEY}.unreadable.${Date.now()}`, raw);
    return initialState;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useAppState = () => useSyncExternalStore(subscribe, () => state);
export const getState = () => state;

/**
 * Write a compact snapshot to the App Group (UserDefaults suite) and ask WidgetKit to reload.
 * Widgets read it; the app never reads it back.
 */
export function syncWidgets() {
  try {
    shared?.set('snapshot', JSON.stringify(buildSnapshot(state, toDay(new Date()))));
    ExtensionStorage.reloadWidget();
  } catch (e) {
    // Without the App Group entitlement (e.g. a free developer account) widgets just stay empty.
    console.warn('Widget sync failed', e);
  }
}

function commit(next: State) {
  const prev = state;
  state = next;
  Storage.setItemSync(KEY, serializeBackup(state));
  syncWidgets();
  if (prev.timer !== next.timer) syncTimer(prev, next);
  listeners.forEach((l) => l());
}

/** What the Live Activity shows for the current timer. */
function activityState(s: State, now = new Date()): FocusActivityState | null {
  const t = s.timer;
  const task = t && s.tasks.find((x) => x.id === t.taskId);
  if (!t || !task) return null;
  const tag = tagOf(s, task);
  const remaining = Math.round(timerRemaining(t, now));
  return {
    title: task.title,
    ...(tag ? { tag: tag.name, tagColor: tag.color } : {}),
    due: dueLabel(task.scheduledFor!, toDay(now)),
    totalSec: Math.floor(taskFocusSeconds(s, task.id, now)),
    plannedSec: t.plannedSec,
    endsAt: t.runStartedAt ? now.getTime() + remaining * 1000 : null,
    remainingSec: remaining,
  };
}

/**
 * Keep the Live Activity and the App Group copy of the timer in step with the app.
 * The Lock Screen pause button edits that copy; adoptSharedTimer() reads it back.
 */
function syncTimer(prev: State, next: State) {
  try {
    shared?.set('timer', next.timer ? JSON.stringify(next.timer) : undefined);
  } catch {}
  const content = activityState(next);
  if (!content) endFocusActivity();
  else if (!prev.timer || prev.timer.taskId !== next.timer!.taskId) startFocusActivity(content);
  else updateFocusActivity(content);
}

/** Pick up a pause/resume made from the Live Activity while the app was in the background. */
function adoptSharedTimer() {
  if (!state.timer || !shared) return;
  let raw: string | null = null;
  try {
    raw = shared.get('timer');
  } catch {}
  const theirs = raw ? parseTimer(JSON.parse(raw), state.tasks) : null;
  if (theirs && theirs.taskId === state.timer.taskId && theirs.updatedAt > state.timer.updatedAt) commit({ ...state, timer: theirs });
}
adoptSharedTimer();
AppState.addEventListener('change', (s) => s === 'active' && adoptSharedTimer());

/** Apply a domain action. Returns the error message if the action was rejected, else null. */
export function act(fn: (s: State) => State): string | null {
  let next: State;
  try {
    next = fn(state);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  commit(next);
  return null;
}

/** Replace everything (used by backup import, after the file has been validated). */
export const replaceState = (next: State) => commit(next);

/** The current time, ticking every `ms` while `active` (for countdowns). */
export function useNow(active: boolean, ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/** Today's local date, refreshed at midnight and whenever the app returns to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDay(new Date()));
  useEffect(() => {
    const refresh = () => setToday(toDay(new Date()));
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(refresh, msToMidnight + 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [today]);
  return today;
}
