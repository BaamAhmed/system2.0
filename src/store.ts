import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { initialState, toDay, type State } from './domain';

let state: State = initialState;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useAppState = () => useSyncExternalStore(subscribe, () => state);
export const getState = () => state;

/** Apply a domain action. Returns the error message if the action was rejected, else null. */
export function act(fn: (s: State) => State): string | null {
  try {
    state = fn(state);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  listeners.forEach((l) => l());
  return null;
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
