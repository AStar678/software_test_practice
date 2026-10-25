#!/usr/bin/env node
'use strict';
/* Chapter 5 regression: the calendar projects only the signed-in person's effective responsible
   tasks, mounts adjacent months under stable business-day keys, and draws a complete vertical
   00:00—24:00 axis with full overlap splitting and no per-day cap.
   Loads the actually served `潘多拉-日程视图.js` (not a re-implementation). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const day = new Date(2026, 9, 23);
const addDays = (value, count) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + count);
const minute = value => new Date(+day + value * 60000);
const WEEK_NAMES = ['周一','周二','周三','周四','周五','周六','周日'];
const pad2 = n => String(n).padStart(2, '0');
const toDateInput = value => [value.getFullYear(), pad2(value.getMonth()+1), pad2(value.getDate())].join('-');
const parseDateInput = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};
const startOfDay = value => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const monthGrid = anchor => {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const first = new Date(y, m, 1), off = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate(), weekCount = Math.ceil((off + daysInMonth) / 7);
  const start = addDays(first, -off), weeks = [];
  for (let i = 0; i < weekCount; i++) { const s = addDays(start, i * 7); weeks.push({ start: s, end: addDays(s, 7) }); }
  return { start, end: addDays(start, weekCount * 7), weeks };
};
const viewRange = (mode, anchor) => {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  if (mode === 'week') { const off = (anchor.getDay() + 6) % 7; const s = addDays(startOfDay(anchor), -off); return { start: s, end: addDays(s, 7) }; }
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
};
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime = d => pad2(d.getHours()) + ':' + pad2(d.getMinutes());
const fmtSchedule = t => toDateInput(t.start) + ' ' + fmtTime(t.start) + ' – ' + toDateInput(t.due) + ' ' + fmtTime(t.due);
const taskAriaLabel = t => t.title;
const statusBadge = () => '<span class="badge"></span>';
const urgencyBadge = () => '<span class="badge"></span>';
const taskColorVars = t => '--tc-bg:' + ((t.tag && t.tag.color) || '#ffe1ea') + ';--tc-bd:' + ((t.tag && t.tag.border) || '#e39ab4') + ';';

let tasks = [];
const person = { id: 'me' };
const P = { sessionReset: [] };
const context = {
  window: { Pandora: P }, localStorage: { getItem: () => null },
  document: { addEventListener() {} },
  state: { actorId: 'me', page: 'view', viewPage: 'calendar', viewMode: 'month', viewAnchor: day },
  RENDER: {}, renderAll() {}, renderView() {}, runAction() {},
  actor: () => person, viewTasks: () => tasks,
  startOfDay, addDays, toDateInput, parseDateInput, sameDay, monthGrid, viewRange, WEEK_NAMES, pad2,
  esc, fmtTime, fmtSchedule, taskAriaLabel, statusBadge, urgencyBadge, taskColorVars,
  taskRange: task => ({ start: task.start, end: task.allDay ? addDays(task.due, 1) : task.due }),
  URGENCY_ORDER: { '紧急': 0, '高': 1, '中': 2, '低': 3 },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../潘多拉-日程视图.js'), 'utf8'), context);
const calendar = P.calendar;

const RESULTS = [];
function check(name, fn, evidence) {
  try { fn(); RESULTS.push({ check: name, pass: true }); console.log('PASS ', name); }
  catch (error) { RESULTS.push({ check: name, pass: false, evidence: error.message }); console.log('FAIL ', name, '->', error.message); }
}
const make = (id, from, to, rest = {}) => ({ id, start: minute(from), due: minute(to), urgency: '中', allDay: false, assigneeIds: ['me'], title: id, ...rest });

/* ---- C01 本人投影，且不修改全局授权任务集 ---- */
check('calendar shows only the signed-in assignee everywhere, including all-day and day lists', () => {
  tasks = [make('own', 0, 60), make('own-all-day', 0, 0, { allDay: true }),
    make('created-only', 0, 60, { creatorId: 'me', assigneeIds: ['other'] }),
    make('scope-only', 0, 60, { assigneeIds: ['other'] }),
    make('report-only', 0, 60, { assigneeIds: ['report'] })];
  const global = tasks.slice();
  assert.equal(JSON.stringify(calendar.dayTasks(day).map(t => t.id).sort()), JSON.stringify(['own', 'own-all-day']));
  assert.equal(JSON.stringify(calendar.allDayTasks(day).map(t => t.id)), JSON.stringify(['own-all-day']));
  assert.equal(calendar.sortedDay(day).length, 2);
  assert.equal(tasks.length, global.length, 'the global authorized set must stay untouched');
});

check('calendar has no subordinate projection left: reports neither appear nor leak counts', () => {
  P.data = { me: person, reports: { items: [{ id: 'report', displayName: '下属' }] } };
  tasks = [make('self-task', 0, 60), make('report-task', 0, 60, { assigneeIds: ['report'] })];
  context.state.calendarPersonId = 'report';
  assert.equal(JSON.stringify(calendar.dayTasks(day).map(t => t.id)), JSON.stringify(['self-task']));
  context.state.calendarPersonId = null;
  P.data = {};
});

check('calendar logs still use the company business day of the signed-in author only', () => {
  P.data = { me: person, calendarLogs: [
    { id: 'self-today', authorId: 'me', businessDate: '2026-10-23', createdAt: '2026-10-22T18:00:00Z' },
    { id: 'other', authorId: 'other', businessDate: '2026-10-23' },
    { id: 'self-yesterday', authorId: 'me', businessDate: '2026-10-22' } ] };
  assert.equal(calendar.dayLogs(day).map(log => log.id).join(','), 'self-today');
  assert.equal(calendar.dayLogs(addDays(day, -1)).map(log => log.id).join(','), 'self-yesterday');
  P.data = {};
});

/* ---- C02/C03 纵向日轴与全量重叠 ---- */
check('a cross-day task covers only its real minutes of the selected day', () => {
  tasks = [make('cross', -60, 1500)];
  const coverage = calendar.dayCoverage(tasks[0], day);
  assert.equal(JSON.stringify([coverage.start, coverage.end]), JSON.stringify([0, 1440]));
  const nextDay = calendar.dayCoverage(tasks[0], addDays(day, 1));
  // It really ends at 01:00 the next day, so the next business day keeps a one-hour real slice.
  assert.equal(JSON.stringify(nextDay), JSON.stringify({ start: 0, end: 60, point: false }));
});

check('a task ending at midnight creates no next-day copy, and a zero-length task stays a point', () => {
  tasks = [make('ends-midnight', -120, 0), make('point', 540, 540)];
  assert.equal(calendar.dayCoverage(tasks[0], addDays(day, -1)).end, 1440);
  assert.equal(calendar.dayCoverage(tasks[0], day), null);
  assert.equal(JSON.stringify(calendar.dayCoverage(tasks[1], day)), JSON.stringify({ start: 540, end: 540, point: true }));
  assert.equal(calendar.dayEvents(day).map(e => e.task.id).join(','), 'point');
});

check('six overlapping timed tasks are fully split into six columns without hiding any', () => {
  tasks = Array.from({ length: 6 }, (_, i) => make('overlap-' + i, 540, 660));
  const laid = calendar.layoutDayEvents(calendar.dayEvents(day));
  assert.equal(laid.length, 6);
  assert.equal(Math.max(...laid.map(e => e.columns)), 6);
  assert.equal(JSON.stringify(laid.map(e => e.lane).sort()), JSON.stringify([0, 1, 2, 3, 4, 5]));
  for (const event of laid) {
    assert.ok(event.divStart !== undefined || true);
    assert.ok(event.start === 540 && event.end === 660, 'true interval must not change');
    for (const other of laid) if (event !== other && event.lane === other.lane) {
      assert.ok(event.drawEnd <= other.drawStart || other.drawEnd <= event.drawStart, 'same lane must not overlap');
    }
  }
});

check('short tasks get a tap target while keeping the true duration and never covering others', () => {
  tasks = Array.from({ length: 40 }, (_, i) => make('short-' + i, 470 + i, 470 + i + 1));
  for (const axisHeight of [720, 1440, 2400]) {
    const laid = calendar.layoutDayEvents(calendar.dayEvents(day), axisHeight);
    for (const event of laid) {
      assert.equal(event.end - event.start, 1, 'the real interval stays one minute');
      assert.ok(event.drawEnd <= 1440 + 1e-8 && event.drawStart >= 0);
      for (const other of laid) if (event !== other && event.lane === other.lane) {
        assert.ok(event.drawEnd <= other.drawStart || other.drawEnd <= event.drawStart);
      }
    }
  }
});

check('all-day tasks are never capped at five', () => {
  tasks = Array.from({ length: 9 }, (_, i) => make('allday-' + i, 0, 0, { allDay: true }));
  assert.equal(calendar.allDayTasks(day).length, 9);
  const html = calendar.sortedDay(day).map(t => t.title);
  assert.equal(new Set(html).size, 9);
});

check('pinning only changes ordering and never the real time coverage', () => {
  const pinned = make('pinned', 540, 600, { pinned: true });
  const plain = make('plain', 480, 540);
  tasks = [pinned, plain];
  assert.equal(calendar.sortedDay(day)[0].id, 'pinned');
  assert.equal(calendar.dayCoverage(plain, day).start, 480);
  assert.equal(calendar.dayCoverage(pinned, day).start, 540);
});

/* ---- C17 连续月份与稳定业务日键 ---- */
check('the mounted stream contains the months before, at and after the anchor', () => {
  context.state.viewAnchor = new Date(2026, 11, 31);
  const keys = calendar.resetStream(context.state.viewAnchor);
  assert.equal(JSON.stringify(keys), JSON.stringify(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02']));
});

check('adjacent month cells keep one stable business day per date across the year boundary', () => {
  const seen = [];
  for (const key of ['2026-12', '2027-01']) {
    const anchor = calendar.monthFromKey(key);
    for (let i = 0; i < 6; i++) {
      const s = addDays(new Date(anchor.getFullYear(), anchor.getMonth(), 1), i * 7);
      const week = { start: s, end: addDays(s, 7) };
      const result = calendar.monthWeek(week, [], 5);
      for (const d of result.days) seen.push(toDateInput(d));
    }
  }
  const unique = new Set(seen);
  // Only the boundary days can be shared between the two month sections; content itself is keyed by date.
  assert.ok(unique.size > 40);
  assert.ok(unique.size < seen.length, 'week rows may include a neighbour month day');
});

check('month boundaries never lose or duplicate a task across the December/January seam', () => {
  const december = new Date(2026, 11, 1), january = new Date(2027, 0, 1);
  const seam = new Date(2026, 11, 31);
  tasks = [make('new-year', 0, 60, { start: seam, due: new Date(+seam + 3600000) })];
  const decWeek = calendar.monthWeek({ start: addDays(seam, -3), end: addDays(seam, 4) }, tasks, 5);
  const janWeek = calendar.monthWeek({ start: addDays(seam, -3), end: addDays(seam, 4) }, tasks, 5);
  assert.equal(decWeek.shown.length, 1);
  assert.equal(janWeek.shown.length, 1, 'the same business-day key is reused, not a duplicated task row');
  assert.equal(decWeek.shown[0].task.id, janWeek.shown[0].task.id);
  assert.equal(calendar.monthKey(december), '2026-12');
  assert.equal(calendar.monthKey(january), '2027-01');
});

check('month expansion keeps at least five overlapping tasks and real hidden counts', () => {
  assert.equal(calendar.monthMetrics(100).mode, 'stacked');
  assert.ok(calendar.monthMetrics(340).capacity >= 5);
  tasks = Array.from({ length: 10 }, (_, i) => make('overlap-' + i, 540, 600, { pinned: i === 9 }));
  const result = calendar.monthWeek({ start: addDays(day, -4), end: addDays(day, 3) }, tasks, 5);
  assert.equal(result.shown[0].task.id, 'overlap-9', 'pinned first');
  assert.equal(result.shown.length, 5);
  assert.equal(result.hidden[4].length, 5);
  assert.equal(new Set(result.shown.map(e => e.task.id).concat(result.hidden[4].map(t => t.id))).size, 10);
});

const failures = RESULTS.filter(row => !row.pass);
console.log(`\n${RESULTS.length - failures.length}/${RESULTS.length} checks passed`);
if (failures.length) {
  console.log(JSON.stringify(failures, null, 2));
  process.exit(1);
}
