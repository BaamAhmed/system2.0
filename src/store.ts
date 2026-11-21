import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import { ExtensionStorage } from '@bacons/apple-targets';
import { buildSnapshot, initialState, parseBackup, serializeBackup, toDay, type State } from './domain';

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
  state = next;
  Storage.setItemSync(KEY, serializeBackup(state));
  syncWidgets();
  listeners.forEach((l) => l());
}

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
