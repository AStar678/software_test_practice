'use strict';
const { waitFor, sleep } = require('./browser_fixture');

// Regression entry for the reported defect: after a preserved-session page refresh the daily
// calendar must already provide scroll range in both directions, so a real horizontal gesture
// browses months without the user first clicking 上一月/下一月/年月/今天. Every viewport records
// the initial month window, container/scroll widths, scroll position and the gesture result so
// the pre-fix failure and the fixed behavior stay directly comparable.
const SIZES = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
  { width: 390, height: 600 },
];

module.exports = async function checkDailyItemsRefresh(b, fixture, check, evidence) {
  const ev = b.evaluate;

  // A real input gesture (touch source) through the browser's own scrolling pipeline; never a
  // synthetic DOM scroll event, which would let a broken binding look healthy. A short screen has
  // to scroll the calendar into view first, exactly as a user would, and the gesture must start
  // inside the part of the scroller that is actually on screen.
  async function swipe(distance) {
    await ev(`(()=>{const main=document.getElementById('appMain');
      const box=()=>document.getElementById('dailyScroller').getBoundingClientRect();
      const nav=document.getElementById('tabbar').getBoundingClientRect();
      const r=box();
      if(r.top<60||r.bottom>nav.top) main.scrollTop=Math.max(0,main.scrollTop+r.top-90);
      return true})()`);
    await sleep(150);
    const box = await ev(`(()=>{const s=document.getElementById('dailyScroller');
      const r=s.getBoundingClientRect(),nav=document.getElementById('tabbar').getBoundingClientRect();
      const top=Math.max(r.top,0),bottom=Math.min(r.bottom,nav.top,innerHeight);
      return {x:Math.round(r.left+r.width/2),y:Math.round((top+bottom)/2),onScreen:bottom-top>60}})()`);
    if (!box.onScreen) return { left: await ev("document.getElementById('dailyScroller').scrollLeft"),
      open: await ev("!document.getElementById('overlay').hidden"), onScreen: false };
    await b.send('Input.synthesizeScrollGesture', { x: box.x, y: box.y, xDistance: -distance, yDistance: 0,
      speed: 900, gestureSourceType: 'touch', repeatCount: 1 });
    await sleep(400);
    return ev("(()=>{const s=document.getElementById('dailyScroller');return {left:s.scrollLeft,open:!document.getElementById('overlay').hidden}})()");
  }

  const rows = [];
  for (const size of SIZES) {
    await b.viewport({ ...size, mobile: size.width < 1000 });
    await b.send('Page.reload', { ignoreCache: true });
    const ready = await waitFor(b, "Pandora.ready&&Pandora.idle()&&!!document.getElementById('dailyScroller')", 25000);
    await sleep(300);
    if (!ready) {
      rows.push({ viewport: size.width + 'x' + size.height, ready: false });
      continue;
    }
    const initial = await ev(`(()=>{const s=document.getElementById('dailyScroller'),r=s.getBoundingClientRect();
      const months=Array.from(s.querySelectorAll('.daily-month')).map(el=>el.dataset.month);
      const today=document.querySelector('[data-daily-date="${fixture.today}"]'),box=today?today.getBoundingClientRect():null;
      return {months:months,clientWidth:s.clientWidth,scrollWidth:s.scrollWidth,scrollLeft:Math.round(s.scrollLeft),
        maxLeft:Math.max(0,s.scrollWidth-s.clientWidth),
        todayVisible:!!box&&box.left>=r.left-1&&box.right<=r.right+1}})()`);
    const forward = await swipe(220);
    const backward = await swipe(-220);
    rows.push({ viewport: size.width + 'x' + size.height, ready,
      initial,
      canSlideBack: initial.scrollLeft > 1,
      canSlideForward: initial.maxLeft - initial.scrollLeft > 1,
      forward, backward,
      movedForward: forward.left > initial.scrollLeft + 40,
      movedBackward: backward.left < forward.left - 40 });
  }
  evidence('refresh-after-reload', rows);

  for (const row of rows) {
    check(`after a preserved-session refresh at ${row.viewport} the calendar already has scroll range in both directions`,
      row.ready && row.canSlideBack && row.canSlideForward, row);
    check(`a real horizontal gesture at ${row.viewport} browses forward and back without opening a day list`,
      row.movedForward && row.movedBackward && !row.forward.open && !row.backward.open, row);
  }

  // Leave the suite in its default viewport with a freshly rendered calendar.
  await b.viewport({ width: 390, height: 844, mobile: true });
  await b.send('Page.reload', { ignoreCache: true });
  await waitFor(b, "Pandora.ready&&Pandora.idle()&&!!document.getElementById('dailyScroller')", 25000);
};
