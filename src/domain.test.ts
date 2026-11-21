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

test('tags: add, rename, recolor; names unique', () => {
  let s = d.addTag(d.initialState, ' Work ', d.TAG_COLORS[15]);
  assert.equal(s.tags[0].name, 'Work');
  assert.throws(() => d.addTag(s, 'work', d.TAG_COLORS[0]), /already a tag/);
  assert.throws(() => d.addTag(s, '  ', d.TAG_COLORS[0]), /required/);
  s = d.editTag(s, s.tags[0].id, { name: 'Job', color: d.TAG_COLORS[0] });
  assert.deepEqual([s.tags[0].name, s.tags[0].color], ['Job', d.TAG_COLORS[0]]);
});

test('tags: tasks get one tag; deleting a tag untags its tasks', () => {
  let s = d.addTag(d.initialState, 'Home', d.TAG_COLORS[7]);
  const tag = s.tags[0].id;
  s = d.addTask(s, 'Fix tap', at(TODAY), tag);
  s = d.addTask(s, 'Call mum', at(TODAY));
  assert.equal(d.tagOf(s, s.tasks[0])?.name, 'Home');
  assert.equal(d.openTaskCount(s, tag), 1);
  s = d.editTask(s, id(s, 'Call mum'), { tagId: tag });
  assert.equal(d.openTaskCount(s, tag), 2);
  assert.throws(() => d.editTask(s, id(s, 'Call mum'), { tagId: 'nope' }), /Tag not found/);
  s = d.deleteTag(s, tag);
  assert.equal(s.tags.length, 0);
  assert.equal(s.tasks.length, 2);
  assert.ok(s.tasks.every((t) => t.tagId === undefined));
});

test('snapshot carries the tag color of active tasks', () => {
  let s = d.addTag(d.initialState, 'Work', '#4FAAFE');
  s = d.addTask(s, 'tagged', at(TODAY), s.tags[0].id);
  s = d.addTask(s, 'plain', at(TODAY));
  s = sched(sched(s, 'tagged'), 'plain');
  assert.deepEqual(d.buildSnapshot(s, TODAY).active.map((a) => a.color), ['#4FAAFE', undefined]);
});

test('backup keeps tags and drops references to missing ones', () => {
  let s = d.addTag(d.initialState, 'Work', '#4FAAFE');
  s = d.addTask(s, 'x', at(TODAY), s.tags[0].id);
  assert.deepEqual(d.parseBackup(d.serializeBackup(s)), s);
  const dangling = JSON.parse(d.serializeBackup(s));
  dangling.tags = [];
  assert.equal(d.parseBackup(JSON.stringify(dangling)).tasks[0].tagId, undefined);
  assert.throws(() => d.parseBackup(JSON.stringify({ tasks: [], tags: [{ id: 'a', name: 'x', color: 'red' }] })), /Tag 1/);
});

const plus = (d: Date, sec: number) => new Date(d.getTime() + sec * 1000);

test('timer: start only on Focus tasks, one at a time, 10 min to 3 h', () => {
  let s = withTasks(2);
  s = sched(s, 't0');
  const t0 = at(TODAY, 9);
  assert.throws(() => d.startTimer(s, id(s, 't1'), 30, t0), /Only tasks on Focus/);
  assert.throws(() => d.startTimer(s, id(s, 't0'), 5, t0), /10 minutes/);
  assert.throws(() => d.startTimer(s, id(s, 't0'), 35, t0), /10 minutes/);
  s = d.startTimer(s, id(s, 't0'), 30, t0);
  assert.throws(() => d.startTimer(s, id(s, 't0'), 30, t0), /already running/);
  assert.equal(d.timerRemaining(s.timer!, plus(t0, 600)), 1200);
});

test('timer: paused time does not count; overrun is never counted', () => {
  let s = sched(withTasks(1), 't0');
  const t0 = at(TODAY, 9);
  s = d.startTimer(s, id(s, 't0'), 30, t0);
  s = d.pauseTimer(s, plus(t0, 600)); // 10 min focused
  assert.equal(d.timerElapsed(s.timer!, plus(t0, 3600)), 600); // paused for 50 min
  s = d.resumeTimer(s, plus(t0, 3600));
  assert.ok(!d.isTimeUp(s.timer!, plus(t0, 3600 + 1199)));
  assert.ok(d.isTimeUp(s.timer!, plus(t0, 3600 + 1200)));
  s = d.stopTimer(s, plus(t0, 9000)); // long after zero
  assert.equal(s.timer, null);
  assert.deepEqual(s.sessions.map((x) => x.seconds), [1800]);
  assert.equal(d.taskFocusSeconds(s, id(s, 't0')), 1800);
});

test('timer: +10 min after time is up only adds the new 10 minutes', () => {
  let s = sched(withTasks(1), 't0');
  const t0 = at(TODAY, 9);
  s = d.startTimer(s, id(s, 't0'), 10, t0);
  s = d.extendTimer(s, 10, plus(t0, 900)); // 5 min overrun is dropped
  assert.equal(d.timerRemaining(s.timer!, plus(t0, 900)), 600);
  s = d.stopTimer(s, plus(t0, 1500));
  assert.equal(s.sessions[0].seconds, 1200);
});

test('timer: completing or unscheduling the task records the session; deleting drops it', () => {
  let s = sched(sched(withTasks(2), 't0'), 't1');
  const t0 = at(TODAY, 9);
  const done = d.complete(d.startTimer(s, id(s, 't0'), 30, t0), id(s, 't0'), plus(t0, 300));
  assert.equal(done.timer, null);
  assert.equal(done.sessions[0].seconds, 300);
  const back = d.unschedule(d.startTimer(s, id(s, 't1'), 30, t0), id(s, 't1'), plus(t0, 120));
  assert.equal(back.sessions[0].seconds, 120);
  const gone = d.deleteTask(d.startTimer(s, id(s, 't1'), 30, t0), id(s, 't1'));
  assert.equal(gone.timer, null);
  assert.equal(gone.sessions.length, 0);
});

test('focus analytics: by day, by tag, by time of day, averages', () => {
  let s = d.addTag(d.initialState, 'Work', '#4FAAFE');
  const work = s.tags[0].id;
  s = d.addTask(s, 'a', at(TODAY), work);
  s = d.addTask(s, 'b', at(TODAY));
  s = sched(sched(s, 'a'), 'b');
  const run = (st: d.State, title: string, start: Date, min: number) => d.stopTimer(d.startTimer(st, id(st, title), 60, start), plus(start, min * 60));
  s = run(s, 'a', at(TODAY, 9), 40); // morning
  s = run(s, 'b', at(TODAY, 14), 20); // afternoon
  s = run(s, 'a', at('2026-11-20', 23), 60); // night, yesterday
  assert.deepEqual(d.focusByDay(s.sessions, TODAY), { [TODAY]: 3600, '2026-11-20': 3600 });
  assert.deepEqual(d.focusByTag(s, TODAY), [{ tagId: work, seconds: 6000 }, { tagId: null, seconds: 1200 }]);
  assert.deepEqual(d.focusByTimeOfDay(s.sessions, TODAY), [2400, 1200, 0, 3600]);
  assert.equal(d.averageSession(s.sessions), 2400);
  const snap = d.buildSnapshot(s, TODAY);
  assert.deepEqual(snap.focus, { [TODAY]: 3600, '2026-11-20': 3600 });
  assert.deepEqual(snap.focusTags, [{ name: 'Work', color: '#4FAAFE', seconds: 6000 }, { name: 'No tag', seconds: 1200 }]);
  s = d.complete(s, id(s, 'a'));
  assert.equal(d.perFinishedTask(s), 6000);
  assert.deepEqual([0, 60, 1800, 3600, 7200].map(d.focusLevel), [0, 1, 2, 3, 4]);
});

test('duration and clock formatting', () => {
  assert.deepEqual([0, 30, 59 * 60, 3600, 4800].map(d.formatDuration), ['0m', '<1m', '59m', '1h', '1h 20m']);
  assert.deepEqual([1453, 4120, 0.2, 0].map(d.formatClock), ['24:13', '1:08:40', '0:01', '0:00']);
});

test('due labels for the timer', () => {
  assert.equal(d.dueLabel(TODAY, TODAY), 'Due today');
  assert.equal(d.dueLabel('2026-11-22', TODAY), 'Due tomorrow');
  assert.equal(d.dueLabel('2026-11-23', TODAY), 'Due Mon 23');
  assert.equal(d.dueLabel('2026-11-19', TODAY), 'Due last Thursday');
  assert.equal(d.dueLabel('2026-11-10', TODAY), 'Due Nov 10');
});

test('backup round-trips sessions and the timer; stale timers are dropped', () => {
  let s = sched(withTasks(1), 't0');
  s = d.startTimer(s, id(s, 't0'), 30, at(TODAY, 9));
  s = d.pauseTimer(s, at(TODAY, 10));
  const back = d.parseBackup(d.serializeBackup(s));
  assert.deepEqual(back.timer, s.timer);
  const stale = JSON.parse(d.serializeBackup(s));
  stale.tasks[0].scheduledFor = null; // task left Focus
  assert.equal(d.parseBackup(JSON.stringify(stale)).timer, null);
});
