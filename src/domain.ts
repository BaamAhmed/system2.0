// The whole task system as pure functions. The store, the screens and the widget
// snapshot all go through here, so the rules (3-slot cap, horizon) live in one place.

export type Task = {
  id: string;
  title: string;
  notes?: string;
  createdAt: string; // ISO timestamp
  scheduledFor: string | null; // 'YYYY-MM-DD' (local day)
  completedAt: string | null; // ISO timestamp
  tagId?: string;
};

export type Tag = { id: string; name: string; color: string };

export type State = {
  tasks: Task[]; // backlog order = array order
  tags: Tag[];
  sessions: FocusSession[]; // finished focus timers
  timer: Timer | null; // the one running or paused timer, if any
  horizonDays: number;
};

/** Time actually spent focusing on a task (paused time and overrun past zero don't count). */
export type FocusSession = { id: string; taskId: string; startedAt: string; seconds: number };

/** A focus timer. Elapsed = accruedSec + (now − runStartedAt) while running; paused when runStartedAt is null. */
export type Timer = {
  taskId: string;
  plannedSec: number;
  startedAt: string; // first start, used for time-of-day stats
  runStartedAt: string | null;
  accruedSec: number;
  updatedAt: string; // last change; the Live Activity's pause button can change it from outside the app
};

export const MAX_ACTIVE = 3;
export const HORIZON_MIN = 1;
export const HORIZON_MAX = 30;
export const FULL_MESSAGE = '3 of 3 slots used: finish or unschedule a task first.';

export const initialState: State = { tasks: [], tags: [], sessions: [], timer: null, horizonDays: 7 };

/** 24 evenly bright hues (OKLCH L≈0.72). Red is left out: it means overdue and drives the heatmap. */
export const TAG_COLORS = [
  '#FE7802', '#EA8A0A', '#D99605', '#C89F07', '#B6A708', '#A0B00F', '#7DBA0C', '#4EC14A',
  '#02C375', '#0CC096', '#14BEAB', '#07BCBD', '#12B9CE', '#17B6DF', '#01B1F7', '#4FAAFE',
  '#73A3FD', '#8B9BFF', '#A292FE', '#B986FE', '#D17AF4', '#E273DF', '#F16DC6', '#FC69AB',
];

// ---------- days ('YYYY-MM-DD', local time) ----------

const pad = (n: number) => String(n).padStart(2, '0');
export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (day: string, n: number) => {
  const d = fromDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
};
export const daysBetween = (from: string, to: string) =>
  Math.round((fromDay(to).getTime() - fromDay(from).getTime()) / 86_400_000);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Tomorrow", "Mon 23", "Dec 4", or "Overdue since Thu" for past days. */
export function dayLabel(day: string, today: string): string {
  const d = fromDay(day);
  const n = daysBetween(today, day);
  const near = `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
  if (n < 0) return `Overdue since ${n >= -6 ? WEEKDAYS[d.getDay()] : `${MONTHS[d.getMonth()]} ${d.getDate()}`}`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return n < 7 ? near : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const LONG_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Calm due wording for the timer and Live Activity: "Due today", "Due Mon 23", "Due last Thursday". */
export function dueLabel(day: string, today: string): string {
  const d = fromDay(day);
  const n = daysBetween(today, day);
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n < 0 && n >= -6) return `Due last ${LONG_WEEKDAYS[d.getDay()]}`;
  if (n > 0 && n < 7) return `Due ${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
  return `Due ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// ---------- queries ----------

export const isActive = (t: Task) => !t.completedAt && t.scheduledFor !== null;
export const isBacklog = (t: Task) => !t.completedAt && t.scheduledFor === null;
export const isOverdue = (t: Task, today: string) => isActive(t) && t.scheduledFor! < today;

export const backlog = (s: State) => s.tasks.filter(isBacklog);
export const active = (s: State) =>
  s.tasks.filter(isActive).sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
// Overdue tasks are still active, so they keep using a slot.
export const openSlots = (s: State) => Math.max(0, MAX_ACTIVE - active(s).length);

export const lastSchedulableDay = (s: State, today: string) => addDays(today, s.horizonDays);

/** Why `id` can't be scheduled on `day`, or null if it can. */
export function scheduleError(s: State, id: string, day: string, today: string): string | null {
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return 'Task not found.';
  if (task.completedAt) return 'Task is already complete.';
  if (day < today || day > lastSchedulableDay(s, today))
    return `Pick a day between today and ${s.horizonDays} days ahead.`;
  // Rescheduling an active task doesn't need a new slot.
  if (!isActive(task) && openSlots(s) === 0) return FULL_MESSAGE;
  return null;
}

// ---------- actions (return a new State, throw on invalid input) ----------

const update = (s: State, id: string, patch: Partial<Task>): State => {
  if (!s.tasks.some((t) => t.id === id)) throw new Error('Task not found.');
  return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function addTask(s: State, title: string, now = new Date(), tagId?: string): State {
  const clean = title.trim();
  if (!clean) throw new Error('Title is required.');
  const task: Task = { id: newId(), title: clean, createdAt: now.toISOString(), scheduledFor: null, completedAt: null };
  if (tagId && s.tags.some((t) => t.id === tagId)) task.tagId = tagId;
  return { ...s, tasks: [...s.tasks, task] };
}

export function editTask(s: State, id: string, fields: { title?: string; notes?: string; tagId?: string | null }): State {
  const patch: Partial<Task> = {};
  if (fields.tagId !== undefined) {
    if (fields.tagId !== null && !s.tags.some((t) => t.id === fields.tagId)) throw new Error('Tag not found.');
    patch.tagId = fields.tagId ?? undefined;
  }
  if (fields.title !== undefined) {
    if (!fields.title.trim()) throw new Error('Title is required.');
    patch.title = fields.title.trim();
  }
  if (fields.notes !== undefined) patch.notes = fields.notes.trim() || undefined;
  return update(s, id, patch);
}

/** Deleting a task drops its running timer; its past sessions stay in the stats (as untagged). */
export function deleteTask(s: State, id: string): State {
  return { ...s, timer: s.timer?.taskId === id ? null : s.timer, tasks: s.tasks.filter((t) => t.id !== id) };
}

export function schedule(s: State, id: string, day: string, today: string): State {
  const err = scheduleError(s, id, day, today);
  if (err) throw new Error(err);
  return update(s, id, { scheduledFor: day });
}

// A task leaving Focus ends its timer first, so the focused time is kept.
const endTimerFor = (s: State, id: string, now: Date) => (s.timer?.taskId === id ? stopTimer(s, now) : s);

export const unschedule = (s: State, id: string, now = new Date()) => update(endTimerFor(s, id, now), id, { scheduledFor: null });

// scheduledFor is kept on completed tasks so on-time stats can use it.
export const complete = (s: State, id: string, now = new Date()) => update(endTimerFor(s, id, now), id, { completedAt: now.toISOString() });

/** Undo a completion. It returns to its slot if it had one and a slot is free, otherwise to the backlog, so the cap always holds. */
export function uncomplete(s: State, id: string): State {
  const task = s.tasks.find((t) => t.id === id);
  if (!task?.completedAt) throw new Error('Task is not complete.');
  const backInSlot = task.scheduledFor !== null && openSlots(s) > 0;
  return update(s, id, { completedAt: null, scheduledFor: backInSlot ? task.scheduledFor : null });
}

/** Tasks completed in the last `days` days (today included), newest first. */
export function recentlyCompleted(s: State, today: string, days = 7): Task[] {
  const first = addDays(today, -(days - 1));
  return s.tasks
    .filter((t) => t.completedAt && toDay(new Date(t.completedAt)) >= first)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
}

/** Reorder the backlog to match `ids`; other tasks keep their positions. */
export function reorderBacklog(s: State, ids: string[]): State {
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  const queue = ids.map((id) => byId.get(id)!).filter(Boolean);
  if (queue.length !== backlog(s).length) throw new Error('Reorder must include every backlog task.');
  return { ...s, tasks: s.tasks.map((t) => (isBacklog(t) ? queue.shift()! : t)) };
}

// ---------- tags ----------

const cleanTagName = (s: State, name: string, exceptId?: string) => {
  const clean = name.trim();
  if (!clean) throw new Error('Tag name is required.');
  if (s.tags.some((t) => t.id !== exceptId && t.name.toLowerCase() === clean.toLowerCase())) throw new Error(`There’s already a tag called “${clean}”.`);
  return clean;
};

export function addTag(s: State, name: string, color: string): State {
  return { ...s, tags: [...s.tags, { id: newId(), name: cleanTagName(s, name), color }] };
}

export function editTag(s: State, id: string, fields: { name?: string; color?: string }): State {
  if (!s.tags.some((t) => t.id === id)) throw new Error('Tag not found.');
  const name = fields.name === undefined ? undefined : cleanTagName(s, fields.name, id);
  return { ...s, tags: s.tags.map((t) => (t.id === id ? { ...t, ...(name ? { name } : {}), ...(fields.color ? { color: fields.color } : {}) } : t)) };
}

/** Deleting a tag keeps its tasks; they just become untagged. */
export function deleteTag(s: State, id: string): State {
  return {
    ...s,
    tags: s.tags.filter((t) => t.id !== id),
    tasks: s.tasks.map((t) => (t.tagId === id ? { ...t, tagId: undefined } : t)),
  };
}

export const tagOf = (s: State, t: Task) => (t.tagId ? s.tags.find((g) => g.id === t.tagId) : undefined);
export const openTaskCount = (s: State, tagId: string) => s.tasks.filter((t) => t.tagId === tagId && !t.completedAt).length;

export function setHorizon(s: State, days: number): State {
  return { ...s, horizonDays: Math.min(HORIZON_MAX, Math.max(HORIZON_MIN, Math.round(days))) };
}

// ---------- activity ----------

/** Completions per local day for the `days` days ending today. Days with none are omitted. */
export function completionsByDay(tasks: Task[], today: string, days = 365): Record<string, number> {
  const first = addDays(today, -(days - 1));
  const out: Record<string, number> = {};
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const day = toDay(new Date(t.completedAt));
    if (day >= first && day <= today) out[day] = (out[day] ?? 0) + 1;
  }
  return out;
}

/** Heatmap level 0–4 for a day's count (4 means 4 or more). */
export const heatLevel = (count: number) => Math.min(4, Math.max(0, count));

/** Consecutive days with a completion ending today; a quiet today doesn't break it until tomorrow. */
export function currentStreak(counts: Record<string, number>, today: string): number {
  let day = counts[today] ? today : addDays(today, -1);
  let n = 0;
  while (counts[day]) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(counts: Record<string, number>): number {
  const days = Object.keys(counts).filter((d) => counts[d] > 0).sort();
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && daysBetween(days[i - 1], d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Share of completed scheduled tasks finished on or before their day, 0–1; null if none. */
export function onTimeRate(tasks: Task[]): number | null {
  const done = tasks.filter((t) => t.completedAt && t.scheduledFor);
  if (!done.length) return null;
  return done.filter((t) => toDay(new Date(t.completedAt!)) <= t.scheduledFor!).length / done.length;
}

/** Average completions on days that had at least one, over the given counts. */
export function perActiveDay(counts: Record<string, number>): number {
  const vals = Object.values(counts).filter((v) => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** Monday of the week containing `day`. */
export const weekStart = (day: string) => addDays(day, -((fromDay(day).getDay() + 6) % 7));

/** Counts for Mon..Sun of the current week; days after today are null. */
export function thisWeek(counts: Record<string, number>, today: string): (number | null)[] {
  const mon = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    return d > today ? null : counts[d] ?? 0;
  });
}

/** Average completions per weekday (Mon..Sun) over the `days` days ending today. */
export function weekdayAverages(counts: Record<string, number>, today: string, days = 120): number[] {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  const n = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const k = (fromDay(d).getDay() + 6) % 7;
    sums[k] += counts[d] ?? 0;
    n[k]++;
  }
  return sums.map((v, i) => (n[i] ? v / n[i] : 0));
}

export const sumRange = (counts: Record<string, number>, from: string, to: string) =>
  Object.entries(counts).reduce((a, [d, c]) => (d >= from && d <= to ? a + c : a), 0);

// ---------- focus timers ----------

export const TIMER_MIN = 10;
export const TIMER_MAX = 180;
export const TIMER_STEP = 10;

const sec = (a: string | Date, b: Date) => Math.max(0, (b.getTime() - new Date(a).getTime()) / 1000);
export const timerElapsed = (t: Timer, now = new Date()) => t.accruedSec + (t.runStartedAt ? sec(t.runStartedAt, now) : 0);
export const timerRemaining = (t: Timer, now = new Date()) => Math.max(0, t.plannedSec - timerElapsed(t, now));
export const isTimeUp = (t: Timer, now = new Date()) => timerRemaining(t, now) <= 0;

export function startTimer(s: State, taskId: string, minutes: number, now = new Date()): State {
  if (s.timer) throw new Error('A focus timer is already running.');
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task || !isActive(task)) throw new Error('Only tasks on Focus can be timed.');
  if (minutes < TIMER_MIN || minutes > TIMER_MAX || minutes % TIMER_STEP) throw new Error('Pick between 10 minutes and 3 hours.');
  const at = now.toISOString();
  return { ...s, timer: { taskId, plannedSec: minutes * 60, startedAt: at, runStartedAt: at, accruedSec: 0, updatedAt: at } };
}

const needTimer = (s: State) => {
  if (!s.timer) throw new Error('No focus timer is running.');
  return s.timer;
};

export function pauseTimer(s: State, now = new Date()): State {
  const t = needTimer(s);
  if (!t.runStartedAt) return s;
  return { ...s, timer: { ...t, accruedSec: Math.min(t.plannedSec, timerElapsed(t, now)), runStartedAt: null, updatedAt: now.toISOString() } };
}

export function resumeTimer(s: State, now = new Date()): State {
  const t = needTimer(s);
  if (t.runStartedAt || isTimeUp(t, now)) return s;
  return { ...s, timer: { ...t, runStartedAt: now.toISOString(), updatedAt: now.toISOString() } };
}

/** Add time. Any overrun past zero is dropped first, so it never counts as focus. */
export function extendTimer(s: State, minutes = 10, now = new Date()): State {
  const t = needTimer(s);
  const at = now.toISOString();
  return {
    ...s,
    timer: { ...t, accruedSec: Math.min(t.plannedSec, timerElapsed(t, now)), runStartedAt: t.runStartedAt ? at : null, plannedSec: t.plannedSec + minutes * 60, updatedAt: at },
  };
}

/** End the timer and record the time focused (capped at the planned length). */
export function stopTimer(s: State, now = new Date()): State {
  const t = needTimer(s);
  const seconds = Math.floor(Math.min(t.plannedSec, timerElapsed(t, now)));
  const sessions = seconds > 0 ? [...s.sessions, { id: newId(), taskId: t.taskId, startedAt: t.startedAt, seconds }] : s.sessions;
  return { ...s, timer: null, sessions };
}

/** Total focused seconds on a task, including the timer in progress. */
export function taskFocusSeconds(s: State, taskId: string, now = new Date()): number {
  const past = s.sessions.reduce((a, x) => (x.taskId === taskId ? a + x.seconds : a), 0);
  return past + (s.timer?.taskId === taskId ? Math.min(s.timer.plannedSec, timerElapsed(s.timer, now)) : 0);
}

/** "1h 20m", "45m", "2h"; under a minute is "<1m". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (seconds > 0 && m === 0) return '<1m';
  const h = Math.floor(m / 60);
  return h ? (m % 60 ? `${h}h ${m % 60}m` : `${h}h`) : `${m}m`;
}

/** Countdown text: "24:13" or "1:08:40". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Focused seconds per local day (by session start) for the `days` days ending today. */
export function focusByDay(sessions: FocusSession[], today: string, days = 365): Record<string, number> {
  const first = addDays(today, -(days - 1));
  const out: Record<string, number> = {};
  for (const x of sessions) {
    const day = toDay(new Date(x.startedAt));
    if (day >= first && day <= today) out[day] = (out[day] ?? 0) + x.seconds;
  }
  return out;
}

/** Heatmap level for a day's focus: <30m, <1h, <2h, 2h+. */
export const focusLevel = (seconds: number) => (seconds <= 0 ? 0 : seconds < 1800 ? 1 : seconds < 3600 ? 2 : seconds < 7200 ? 3 : 4);

export const averageSession = (sessions: FocusSession[]) =>
  sessions.length ? sessions.reduce((a, x) => a + x.seconds, 0) / sessions.length : 0;

/** Average focused time on completed tasks that had any focus. */
export function perFinishedTask(s: State): number {
  const totals = s.tasks.filter((t) => t.completedAt).map((t) => taskFocusSeconds(s, t.id)).filter((v) => v > 0);
  return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
}

/** Focused seconds per tag over the last `days` days, largest first. `tagId: null` = untagged or deleted task. */
export function focusByTag(s: State, today: string, days = 30): { tagId: string | null; seconds: number }[] {
  const first = addDays(today, -(days - 1));
  const byTag = new Map<string | null, number>();
  for (const x of s.sessions) {
    if (toDay(new Date(x.startedAt)) < first) continue;
    const tagId = s.tasks.find((t) => t.id === x.taskId)?.tagId ?? null;
    const key = tagId && s.tags.some((g) => g.id === tagId) ? tagId : null;
    byTag.set(key, (byTag.get(key) ?? 0) + x.seconds);
  }
  return [...byTag].map(([tagId, seconds]) => ({ tagId, seconds })).sort((a, b) => b.seconds - a.seconds);
}

export const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

/** Focused seconds by when sessions started: morning 5–12, afternoon 12–17, evening 17–22, night 22–5. */
export function focusByTimeOfDay(sessions: FocusSession[], today: string, days = 30): number[] {
  const first = addDays(today, -(days - 1));
  const out = [0, 0, 0, 0];
  for (const x of sessions) {
    const d = new Date(x.startedAt);
    if (toDay(d) < first) continue;
    const h = d.getHours();
    out[h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3] += x.seconds;
  }
  return out;
}

// ---------- widget snapshot ----------

export type Snapshot = {
  today: string;
  openSlots: number;
  active: { title: string; scheduledFor: string; overdue: boolean; color?: string }[]; // color: the task's tag, if any
  counts: Record<string, number>; // last ~365 days, non-zero only
  bestStreak: number;
  focus: Record<string, number>; // focused seconds per day, last 14 days, non-zero only
  // shortcut: as of `today`, so it doesn't roll over at midnight like `focus` does; send per-day tag totals if that matters.
  focusTags: { name: string; color?: string; seconds: number }[]; // last 7 days, largest first
};

// Widgets recompute day labels/overdue per timeline entry from scheduledFor, so
// the `overdue` flag here is only correct as of `today`.
export function buildSnapshot(s: State, today: string): Snapshot {
  const counts = completionsByDay(s.tasks, today, 371);
  return {
    today,
    openSlots: openSlots(s),
    active: active(s).map((t) => {
      const color = tagOf(s, t)?.color;
      return { title: t.title, scheduledFor: t.scheduledFor!, overdue: isOverdue(t, today), ...(color ? { color } : {}) };
    }),
    counts,
    bestStreak: bestStreak(counts),
    focus: focusByDay(s.sessions, today, 14),
    focusTags: focusByTag(s, today, 7).map(({ tagId, seconds }) => {
      const tag = s.tags.find((g) => g.id === tagId);
      return tag ? { name: tag.name, color: tag.color, seconds } : { name: 'No tag', seconds };
    }),
  };
}

// ---------- backup ----------

const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isIso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Parse and validate an exported backup. Throws with a readable message if it isn't one. */
export function parseBackup(json: string): State {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('This file isn’t valid JSON.');
  }
  if (!data || !Array.isArray(data.tasks)) throw new Error('This file isn’t a system2.0 backup.');
  const tags: Tag[] = (Array.isArray(data.tags) ? data.tags : []).map((g: any, i: number) => {
    if (!g || typeof g.id !== 'string' || typeof g.name !== 'string' || !g.name.trim() || typeof g.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(g.color))
      throw new Error(`Tag ${i + 1} in this file is malformed.`);
    return { id: g.id, name: g.name, color: g.color };
  });
  const tagIds = new Set(tags.map((g) => g.id));
  const seen = new Set<string>();
  const tasks: Task[] = data.tasks.map((t: any, i: number) => {
    const ok =
      t && typeof t.id === 'string' && t.id && !seen.has(t.id) &&
      typeof t.title === 'string' && t.title.trim() &&
      (t.notes === undefined || typeof t.notes === 'string') &&
      isIso(t.createdAt) &&
      (t.scheduledFor === null || isDay(t.scheduledFor)) &&
      (t.completedAt === null || isIso(t.completedAt));
    if (!ok) throw new Error(`Task ${i + 1} in this file is malformed.`);
    seen.add(t.id);
    return {
      id: t.id, title: t.title, ...(t.notes ? { notes: t.notes } : {}), createdAt: t.createdAt, scheduledFor: t.scheduledFor, completedAt: t.completedAt,
      ...(typeof t.tagId === 'string' && tagIds.has(t.tagId) ? { tagId: t.tagId } : {}),
    };
  });
  if (tasks.filter(isActive).length > MAX_ACTIVE) throw new Error('This backup has more than 3 scheduled tasks.');
  const sessions: FocusSession[] = (Array.isArray(data.sessions) ? data.sessions : []).map((x: any, i: number) => {
    if (!x || typeof x.id !== 'string' || typeof x.taskId !== 'string' || !isIso(x.startedAt) || typeof x.seconds !== 'number' || x.seconds < 0)
      throw new Error(`Focus session ${i + 1} in this file is malformed.`);
    return { id: x.id, taskId: x.taskId, startedAt: x.startedAt, seconds: Math.floor(x.seconds) };
  });
  const timer = parseTimer(data.timer, tasks);
  return setHorizon({ tasks, tags, sessions, timer, horizonDays: 7 }, typeof data.horizonDays === 'number' ? data.horizonDays : 7);
}

/** A stored timer, or null if it's missing, malformed, or no longer points at a task on Focus. */
export function parseTimer(t: any, tasks: Task[]): Timer | null {
  const ok =
    t && typeof t.taskId === 'string' && typeof t.plannedSec === 'number' && t.plannedSec > 0 && isIso(t.startedAt) &&
    (t.runStartedAt === null || isIso(t.runStartedAt)) && typeof t.accruedSec === 'number' && t.accruedSec >= 0 && isIso(t.updatedAt) &&
    tasks.some((x) => x.id === t.taskId && isActive(x));
  return ok ? { taskId: t.taskId, plannedSec: t.plannedSec, startedAt: t.startedAt, runStartedAt: t.runStartedAt, accruedSec: t.accruedSec, updatedAt: t.updatedAt } : null;
}

export const serializeBackup = (s: State) => JSON.stringify({ app: 'system2.0', version: 1, ...s }, null, 2);
