// Run with `npm test` (Node's built-in runner; Node strips the TypeScript types).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d from './domain.ts';

const TODAY = '2026-11-21'; // a Saturday
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

/** State with `n` backlog tasks named t0..t{n-1}. */
function withTasks(n: number): d.State {
  let s = d.initialState;
  for (let i = 0; i < n; i++) s = d.addTask(s, `t${i}`, at(TODAY));
  return s;
}
const id = (s: d.State, title: string) => s.tasks.find((t) => t.title === title)!.id;
const sched = (s: d.State, title: string, day = TODAY) => d.schedule(s, id(s, title), day, TODAY);

test('new tasks land in the backlog in order', () => {
  const s = withTasks(3);
  assert.deepEqual(d.backlog(s).map((t) => t.title), ['t0', 't1', 't2']);
  assert.equal(d.active(s).length, 0);
  assert.equal(d.openSlots(s), 3);
});

test('blank titles are rejected', () => {
  assert.throws(() => d.addTask(d.initialState, '   '), /Title is required/);
});

test('cap: a 4th task cannot be scheduled', () => {
  let s = withTasks(4);
  s = sched(sched(sched(s, 't0'), 't1', '2026-11-22'), 't2', '2026-11-23');
  assert.equal(d.openSlots(s), 0);
  assert.equal(d.scheduleError(s, id(s, 't3'), TODAY, TODAY), d.FULL_MESSAGE);
  assert.throws(() => sched(s, 't3'), new RegExp(d.FULL_MESSAGE.slice(0, 20)));
});

test('cap: rescheduling an already-active task is allowed when full', () => {
  let s = withTasks(3);
  s = sched(sched(sched(s, 't0'), 't1'), 't2');
  s = sched(s, 't2', '2026-11-25');
  assert.equal(s.tasks.find((t) => t.title === 't2')!.scheduledFor, '2026-11-25');
});

test('cap: overdue tasks still count toward it', () => {
  let s = withTasks(4);
  // scheduled earlier in the week, now overdue
  s = d.schedule(s, id(s, 't0'), '2026-11-18', '2026-11-18');
  s = d.schedule(s, id(s, 't1'), '2026-11-19', '2026-11-18');
  s = sched(s, 't2');
  assert.ok(d.isOverdue(s.tasks[0], TODAY));
  assert.equal(d.openSlots(s), 0);
  assert.throws(() => sched(s, 't3'), /3 of 3 slots used/);
});

test('completing or unscheduling frees a slot', () => {
  let s = withTasks(4);
  s = sched(sched(sched(s, 't0'), 't1'), 't2');
  const done = d.complete(s, id(s, 't0'), at(TODAY));
  assert.equal(d.openSlots(done), 1);
  assert.doesNotThrow(() => sched(done, 't3'));

  const back = d.unschedule(s, id(s, 't1'));
  assert.equal(d.openSlots(back), 1);
  assert.deepEqual(d.backlog(back).map((t) => t.title), ['t1', 't3']);
});

test('horizon: only today through today + horizonDays', () => {
  const s = withTasks(1);
  const t0 = id(s, 't0');
  assert.equal(d.scheduleError(s, t0, TODAY, TODAY), null);
  assert.equal(d.scheduleError(s, t0, '2026-11-28', TODAY), null); // +7
  assert.match(d.scheduleError(s, t0, '2026-11-29', TODAY)!, /7 days ahead/); // +8
  assert.match(d.scheduleError(s, t0, '2026-11-20', TODAY)!, /between today/); // past
  const short = d.setHorizon(s, 2);
  assert.match(d.scheduleError(short, t0, '2026-11-24', TODAY)!, /2 days ahead/);
});

test('horizon is clamped', () => {
  assert.equal(d.setHorizon(d.initialState, 0).horizonDays, d.HORIZON_MIN);
  assert.equal(d.setHorizon(d.initialState, 99).horizonDays, d.HORIZON_MAX);
});

test('completed tasks cannot be scheduled and leave both lists', () => {
  let s = withTasks(1);
  s = d.complete(s, id(s, 't0'), at(TODAY));
  assert.equal(d.backlog(s).length, 0);
  assert.equal(d.active(s).length, 0);
  assert.throws(() => sched(s, 't0'), /already complete/);
});

test('reorder backlog keeps active tasks in place', () => {
  let s = withTasks(3);
  s = sched(s, 't1');
  s = d.reorderBacklog(s, [id(s, 't2'), id(s, 't0')]);
  assert.deepEqual(d.backlog(s).map((t) => t.title), ['t2', 't0']);
  assert.equal(d.active(s)[0].title, 't1');
  assert.throws(() => d.reorderBacklog(s, [id(s, 't2')]));
});

test('heatmap bucketing: by local day, window-limited', () => {
  let s = withTasks(5);
  s = d.complete(s, id(s, 't0'), at(TODAY, 0));
  s = d.complete(s, id(s, 't1'), at(TODAY, 23));
  s = d.complete(s, id(s, 't2'), at('2026-11-20', 9));
  s = d.complete(s, id(s, 't3'), at('2025-11-21', 9)); // 365 days ago: outside a 365-day window
  const counts = d.completionsByDay(s.tasks, TODAY, 365);
  assert.deepEqual(counts, { '2026-11-21': 2, '2026-11-20': 1 });
  assert.deepEqual([0, 1, 3, 4, 9].map(d.heatLevel), [0, 1, 3, 4, 4]);
});

test('streaks', () => {
  const counts = { '2026-11-21': 1, '2026-11-20': 2, '2026-11-19': 1, '2026-11-17': 3, '2026-11-16': 1 };
  assert.equal(d.currentStreak(counts, TODAY), 3);
  // nothing yet today: yesterday's streak is still alive
  assert.equal(d.currentStreak(counts, '2026-11-22'), 3);
  assert.equal(d.currentStreak(counts, '2026-11-23'), 0);
  assert.equal(d.bestStreak(counts), 3);
});

test('analytics: on-time rate, week, weekday averages', () => {
  let s = withTasks(2);
  s = sched(sched(s, 't0'), 't1', '2026-11-22');
  s = d.complete(s, id(s, 't0'), at('2026-11-23')); // late
  s = d.complete(s, id(s, 't1'), at('2026-11-22')); // on time
  assert.equal(d.onTimeRate(s.tasks), 0.5);
  assert.equal(d.onTimeRate([]), null);

  const counts = { '2026-11-16': 2, '2026-11-21': 1 };
  assert.deepEqual(d.thisWeek(counts, TODAY), [2, 0, 0, 0, 0, 1, null]);
  assert.equal(d.perActiveDay(counts), 1.5);
  assert.equal(d.weekdayAverages(counts, TODAY, 7)[0], 2); // Monday
});

test('snapshot has active tasks in date order, overdue flag and open slots', () => {
  let s = withTasks(3);
  s = d.schedule(s, id(s, 't0'), '2026-11-25', '2026-11-19');
  s = d.schedule(s, id(s, 't1'), '2026-11-19', '2026-11-19');
  s = d.complete(s, id(s, 't2'), at(TODAY));
  const snap = d.buildSnapshot(s, TODAY);
  assert.deepEqual(snap.active, [
    { title: 't1', scheduledFor: '2026-11-19', overdue: true },
    { title: 't0', scheduledFor: '2026-11-25', overdue: false },
  ]);
  assert.equal(snap.openSlots, 1);
  assert.deepEqual(snap.counts, { [TODAY]: 1 });
});

test('backup round-trips and rejects bad input', () => {
  let s = withTasks(2);
  s = d.setHorizon(sched(s, 't0'), 5);
  assert.deepEqual(d.parseBackup(d.serializeBackup(s)), s);
  assert.throws(() => d.parseBackup('nope'), /valid JSON/);
  assert.throws(() => d.parseBackup('{"tasks":[{"id":"a"}]}'), /malformed/);
  const tooMany = { tasks: [0, 1, 2, 3].map((i) => ({ id: `${i}`, title: 'x', createdAt: at(TODAY).toISOString(), scheduledFor: TODAY, completedAt: null })) };
  assert.throws(() => d.parseBackup(JSON.stringify(tooMany)), /more than 3/);
});

test('day labels', () => {
  assert.equal(d.dayLabel(TODAY, TODAY), 'Today');
  assert.equal(d.dayLabel('2026-11-22', TODAY), 'Tomorrow');
  assert.equal(d.dayLabel('2026-11-25', TODAY), 'Wed 25');
  assert.equal(d.dayLabel('2026-12-04', TODAY), 'Dec 4');
  assert.equal(d.dayLabel('2026-11-19', TODAY), 'Overdue since Thu');
  assert.equal(d.dayLabel('2026-11-10', TODAY), 'Overdue since Nov 10');
});

test('uncomplete: back to its slot when one is free, else to the backlog', () => {
  let s = withTasks(4);
  s = sched(sched(sched(s, 't0'), 't1'), 't2');
  s = d.complete(s, id(s, 't0'), at(TODAY));
  assert.equal(d.openSlots(s), 1);

  const undone = d.uncomplete(s, id(s, 't0'));
  assert.equal(d.active(undone).length, 3);
  assert.equal(undone.tasks.find((t) => t.title === 't0')!.completedAt, null);

  // slot taken in the meantime: it goes to the backlog instead of breaking the cap
  const full = sched(s, 't3');
  const back = d.uncomplete(full, id(full, 't0'));
  assert.equal(d.active(back).length, 3);
  assert.ok(d.backlog(back).some((t) => t.title === 't0'));
  assert.throws(() => d.uncomplete(back, id(back, 't0')), /not complete/);
});

test('uncomplete removes the completion from activity counts', () => {
  let s = withTasks(1);
  s = d.complete(s, id(s, 't0'), at(TODAY));
  assert.deepEqual(d.completionsByDay(s.tasks, TODAY), { [TODAY]: 1 });
  s = d.uncomplete(s, id(s, 't0'));
  assert.deepEqual(d.completionsByDay(s.tasks, TODAY), {});
});

test('recently completed: last 7 days, newest first', () => {
  let s = withTasks(3);
  s = d.complete(s, id(s, 't0'), at('2026-11-15')); // 6 days ago: in
  s = d.complete(s, id(s, 't1'), at('2026-11-14')); // 7 days ago: out
  s = d.complete(s, id(s, 't2'), at(TODAY));
  assert.deepEqual(d.recentlyCompleted(s, TODAY).map((t) => t.title), ['t2', 't0']);
});
