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
  horizonDays: number;
};

export const MAX_ACTIVE = 3;
export const HORIZON_MIN = 1;
export const HORIZON_MAX = 30;
export const FULL_MESSAGE = '3 of 3 slots used: finish or unschedule a task first.';

export const initialState: State = { tasks: [], tags: [], horizonDays: 7 };

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

export function deleteTask(s: State, id: string): State {
  return { ...s, tasks: s.tasks.filter((t) => t.id !== id) };
}

export function schedule(s: State, id: string, day: string, today: string): State {
  const err = scheduleError(s, id, day, today);
  if (err) throw new Error(err);
  return update(s, id, { scheduledFor: day });
}

export const unschedule = (s: State, id: string) => update(s, id, { scheduledFor: null });

// scheduledFor is kept on completed tasks so on-time stats can use it.
export const complete = (s: State, id: string, now = new Date()) => update(s, id, { completedAt: now.toISOString() });

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

// ---------- widget snapshot ----------

export type Snapshot = {
  today: string;
  openSlots: number;
  active: { title: string; scheduledFor: string; overdue: boolean; color?: string }[]; // color: the task's tag, if any
  counts: Record<string, number>; // last ~365 days, non-zero only
  bestStreak: number;
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
  return setHorizon({ tasks, tags, horizonDays: 7 }, typeof data.horizonDays === 'number' ? data.horizonDays : 7);
}

export const serializeBackup = (s: State) => JSON.stringify({ app: 'system2.0', version: 1, ...s }, null, 2);
