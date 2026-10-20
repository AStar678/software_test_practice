#!/usr/bin/env node
/**
 * Front-end ordering regression for V-007.
 *
 * Loads the functions from the actually served `潘多拉-日程视图.js` (not a re-implementation) and
 * asserts that the complete day list and the month cell share the same rule: pinned first, then the
 * real start instant, then the stable task id. In particular an all-day task on the selected date
 * must not jump ahead of a timed task that started on an earlier day and continues into that date.
 *
 *     node scripts/check_calendar_sort.js [--file PATH] [--output PATH]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RESULTS = [];

function check(name, condition, evidence) {
  RESULTS.push({ check: name, pass: Boolean(condition), evidence });
  console.log((condition ? 'PASS  ' : 'FAIL  ') + name + (condition ? '' : '  -> ' + JSON.stringify(evidence)));
}

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('function ' + name + ' not found');
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced function ' + name);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const repo = path.resolve(__dirname, '..', '..');
  const file = path.resolve(args.file || path.join(repo, '潘多拉-日程视图.js'));
  const source = fs.readFileSync(file, 'utf8');
  const dayListSort = new Function('return (' + extractFunction(source, 'dayListSort') + ')')();
  const monthSortTasks = new Function('return (' + extractFunction(source, 'monthSortTasks') + ')')();
  const ids = (rows) => rows.map((row) => row.id);

  const previousEvening = Date.parse('2026-10-19T12:00:00Z');   // 20:00 Asia/Shanghai, previous day
  const selectedMidnight = Date.parse('2026-10-19T16:00:00Z');  // 00:00 Asia/Shanghai, selected day
  const crossDayTimed = {
    id: 'earlier-timed', pinned: false, allDay: false,
    start: new Date(previousEvening), due: new Date(selectedMidnight + 2 * 3600 * 1000)
  };
  const laterAllDay = {
    id: 'later-all-day', pinned: false, allDay: true,
    start: new Date(selectedMidnight), due: new Date(selectedMidnight + 12 * 3600 * 1000)
  };

  check('V-007 a cross-day timed task precedes an all-day task that starts later',
    JSON.stringify(ids(dayListSort([laterAllDay, crossDayTimed]))) === JSON.stringify(['earlier-timed', 'later-all-day']),
    { actual: ids(dayListSort([laterAllDay, crossDayTimed])) });
  check('V-007 the complete day list and the month cell agree on the same mix',
    JSON.stringify(ids(dayListSort([laterAllDay, crossDayTimed])))
      === JSON.stringify(ids(monthSortTasks([laterAllDay, crossDayTimed]))),
    { day: ids(dayListSort([laterAllDay, crossDayTimed])), month: ids(monthSortTasks([laterAllDay, crossDayTimed])) });

  const sameStartA = { id: 'a-task', pinned: false, allDay: false, start: new Date(selectedMidnight), due: new Date(selectedMidnight + 3600 * 1000) };
  const sameStartB = { id: 'b-task', pinned: false, allDay: true, start: new Date(selectedMidnight), due: new Date(selectedMidnight + 2 * 3600 * 1000) };
  check('V-007 an identical start falls back to the stable task id in both lists',
    JSON.stringify(ids(dayListSort([sameStartB, sameStartA]))) === JSON.stringify(['a-task', 'b-task'])
      && JSON.stringify(ids(monthSortTasks([sameStartB, sameStartA]))) === JSON.stringify(['a-task', 'b-task']),
    { day: ids(dayListSort([sameStartB, sameStartA])), month: ids(monthSortTasks([sameStartB, sameStartA])) });

  const pinnedAllDay = { ...laterAllDay, id: 'pinned-all-day', pinned: true };
  check('V-007 pinning still wins over the real start and stays private to the list input',
    JSON.stringify(ids(dayListSort([crossDayTimed, pinnedAllDay]))) === JSON.stringify(['pinned-all-day', 'earlier-timed'])
      && JSON.stringify(ids(dayListSort([crossDayTimed, laterAllDay]))) === JSON.stringify(['earlier-timed', 'later-all-day']),
    { pinned: ids(dayListSort([crossDayTimed, pinnedAllDay])), otherAccount: ids(dayListSort([crossDayTimed, laterAllDay])) });

  const failures = RESULTS.filter((row) => !row.pass);
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), JSON.stringify({ file, total: RESULTS.length, failures: failures.length, results: RESULTS }, null, 2));
  }
  console.log(`\n${RESULTS.length - failures.length}/${RESULTS.length} checks passed`);
  return failures.length === 0 ? 0 : 1;
}

process.exit(main());
