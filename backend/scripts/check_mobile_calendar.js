#!/usr/bin/env node
'use strict';
/* Verify the restored calendar against main's visibility and ordering rules, with independent
   interval expectations. No browser state or database is changed. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const day = new Date(2026, 9, 23);
const addDays = (value, count) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + count);
const minute = value => new Date(+day + value * 60000);
let tasks = [];
const person = { id: 'me' };
const P = { sessionReset: [] };
const context = {
  window: { Pandora: P }, localStorage: { getItem: () => null },
  document: { addEventListener() {} },
  state: { actorId: 'me', page: 'view', viewPage: 'calendar', viewMode: 'month', viewAnchor: day },
  RENDER: {}, renderAll() {}, renderView() {}, runAction() {},
  actor: () => person, viewTasks: () => tasks,
  startOfDay: value => new Date(value.getFullYear(), value.getMonth(), value.getDate()), addDays,
  toDateInput: value => [value.getFullYear(), String(value.getMonth()+1).padStart(2,'0'), String(value.getDate()).padStart(2,'0')].join('-'),
  taskRange: task => ({ start: task.start, end: task.allDay ? addDays(task.due, 1) : task.due }),
  URGENCY_ORDER: { '紧急': 0, '高': 1, '中': 2, '低': 3 },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../潘多拉-日程视图.js'), 'utf8'), context);
const calendar = P.calendar;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS', name); }
const make = (id, from, to, rest = {}) => ({ id, start: minute(from), due: minute(to), urgency: '中', allDay: false, assigneeIds: ['me'], ...rest });
check('calendar logs use the company business date and never another author selection', () => {
  P.data = { me: person, calendarLogs: [
    { id: 'self-today', authorId: 'me', businessDate: '2026-10-23', createdAt: '2026-10-22T18:00:00Z' },
    { id: 'other', authorId: 'other', businessDate: '2026-10-23' },
    { id: 'self-yesterday', authorId: 'me', businessDate: '2026-10-22' }
  ] };
  assert.equal(calendar.dayLogs(day).map(log=>log.id).join(','), 'self-today');
  assert.equal(calendar.dayLogs(addDays(day,-1)).map(log=>log.id).join(','), 'self-yesterday');
  P.data = {};
  assert.equal(calendar.dayLogs(day).length, 0);
});
check('stacked month expansion can show at least five overlapping tasks', () => {
  assert.equal(calendar.monthMetrics(100).mode, 'stacked');
  const capacity = calendar.monthMetrics(340).capacity;
  assert.ok(capacity >= 5);
  tasks = Array.from({ length: 10 }, (_,i) => make('overlap-'+i, 540, 600));
  const result = calendar.monthWeek({ start: addDays(day,-4), end: addDays(day,3) }, tasks, capacity);
  assert.ok(result.shown.length >= 5);
  assert.equal(result.shown.length + result.hidden[4].length, 10);
});
check('calendar visibility remains assigned-to-self, independent of creator or broader scope', () => {
  tasks = [make('own', 0, 60), make('created-only', 0, 60, { creatorId: 'me', assigneeIds: ['other'] }),
    make('scope-only', 0, 60, { assigneeIds: ['other'] })];
  assert.equal(calendar.dayTasks(day).map(t => t.id).join(','), 'own');
});
check('calendar subordinate selection stays within actual visible reports and authorized tasks', () => {
  P.data = { me: person, reports: { items: [{ id: 'report' }] } };
  tasks = [make('self-task', 0, 60), make('report-task', 0, 60, {assigneeIds:['report']}),
    make('peer-task', 0, 60, {assigneeIds:['peer']})];
  context.state.calendarPersonId = 'report';
  assert.equal(calendar.dayTasks(day).map(t=>t.id).join(','), 'report-task');
  context.state.calendarPersonId = 'peer';
  assert.equal(calendar.dayTasks(day).map(t=>t.id).join(','), 'self-task');
  context.state.calendarPersonId = null;
  P.data = {};
});
check('08:00 and 16:00 points occur in exactly one band; midnight end is exclusive', () => {
  tasks = [make('at-eight', 480, 480), make('at-sixteen', 960, 960), make('ends-midnight', -120, 0)];
  assert.equal(calendar.segmentsFor(day).map(b => b.events.map(e => e.task.id).join(',')).join('|'), '|at-eight|at-sixteen');
});
check('cross-day segments preserve duration, and all-day tasks stay outside the time bands', () => {
  tasks = [make('cross', -60, 1500), make('all-day', 0, 0, { allDay: true })];
  const bands = calendar.segmentsFor(day);
  assert.equal(bands.map(b => b.events.length).join(','), '1,1,1');
  assert.equal(bands.reduce((total,b) => total + b.events.reduce((sum,e) => sum+e.end-e.start, 0), 0), 1440);
});
check('month hidden counts cover exactly the omitted tasks and preserve pin ordering', () => {
  tasks = Array.from({ length: 8 }, (_,i) => make('task-'+i, i*20, i*20+10, { pinned: i===7 }));
  const week = { start: addDays(day, -4), end: addDays(day, 3) };
  const result = calendar.monthWeek(week, tasks, 3);
  assert.equal(result.shown[0].task.id, 'task-7');
  assert.equal(result.shown.length, 3);
  assert.equal(result.hidden[4].length, 5);
  assert.equal(new Set(result.shown.map(e=>e.task.id).concat(result.hidden[4].map(t=>t.id))).size, 8);
});
check('dense short-event hit targets stay inside bands and never overlap in one lane', () => {
  tasks = Array.from({ length: 40 }, (_,i) => make('short-'+i, 470+i/4, 470+i/4+1));
  for (const width of [120, 320, 1000]) for (const band of calendar.segmentsFor(day)) {
    const laid = calendar.layoutSegments(band, width);
    for (const event of laid) {
      assert.ok(event.drawStart >= band.start && event.drawEnd <= band.end + 1e-8);
      for (const other of laid) if (event !== other && event.lane === other.lane)
        assert.ok(event.drawEnd <= other.drawStart || other.drawEnd <= event.drawStart);
    }
  }
});
check('varied intervals agree with independent half-open clipping across the whole day', () => {
  tasks = Array.from({ length: 80 }, (_,i) => {
    const start = (i*137)%2200-400, duration = (i*59)%800;
    return make('interval-'+i, start, start+duration);
  });
  const bands = calendar.segmentsFor(day);
  for (const task of tasks) {
    const from=(task.start-day)/60000, to=(task.due-day)/60000;
    for (let index=0;index<3;index++) {
      const lo=index*480, hi=lo+480, found=bands[index].events.find(e=>e.task.id===task.id);
      const expected=from===to ? from>=lo && from<hi : to>lo && from<hi;
      assert.equal(Boolean(found), expected, task.id+' in band '+index);
      if (found) { assert.equal(found.start, Math.max(lo,from)); assert.equal(found.end, Math.min(hi,to)); }
    }
  }
});
console.log(`${checks}/${checks} checks passed`);
