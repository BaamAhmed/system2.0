import { requireOptionalNativeModule } from 'expo';

/** What the Live Activity shows. Mirrors FocusActivityAttributes.ContentState (Swift). */
export type FocusActivityState = {
  title: string;
  tag?: string;
  tagColor?: string;
  due: string;
  totalSec: number;
  plannedSec: number;
  endsAt: number | null; // epoch ms; null while paused
  remainingSec: number;
};

type Native = { start(json: string): Promise<void>; update(json: string): Promise<void>; end(): Promise<void> };
const native = requireOptionalNativeModule<Native>('FocusActivity');

// Live Activities are a nice-to-have: failures (turned off, unsupported) never break the timer.
const quiet = (p: Promise<void> | undefined) => p?.catch((e) => console.warn('Live Activity:', e));

export const startFocusActivity = (s: FocusActivityState) => quiet(native?.start(JSON.stringify(s)));
export const updateFocusActivity = (s: FocusActivityState) => quiet(native?.update(JSON.stringify(s)));
export const endFocusActivity = () => quiet(native?.end());
