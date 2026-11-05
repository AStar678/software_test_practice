'use strict';
const { waitFor, sleep } = require('./browser_fixture');

// Use a second authenticated session for mutations, never patch the list data.
module.exports = async function checkDailyItemPaging(b, fixture, check) {
  const ev = b.evaluate, js = JSON.stringify;
  async function ready(expression) {
    if (!await waitFor(b, expression, 15000)) throw Error('not ready: ' + expression);
  }
  await ev(`(async()=>{
    const response=await fetch('/api/v1/auth/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountType:'employee',phone:${js(fixture.identities['alpha-one-employee'].identifier)},password:'Fixture@123456'})});
    const session=await response.json();if(!response.ok)throw Error(JSON.stringify(session));
    window.pagingApi=async(method,path,body,version)=>{
      const headers={'Content-Type':'application/json',Authorization:'Bearer '+session.token};
      if(method!=='GET')headers['Idempotency-Key']=crypto.randomUUID();
      if(version!=null)headers['If-Match']='"'+version+'"';
      const r=await fetch('/api/v1'+path,{method,headers,body:body==null?undefined:JSON.stringify(body)});
      const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));return data;
    };
  })()`);
  async function more() {
    await ev("document.querySelector('[data-action=daily-more]').focus({preventScroll:true});document.querySelector('[data-action=daily-more]').click()");
    await ready('Pandora.idle()&&!PandoraDaily.state.lists.get(sheetStack.at(-1)?.dailyDate)?.loading');
    await sleep(40);
  }
  let scenario = 0;
  for (const count of [60, 105]) {
    for (const mutation of ['first', 'middle', 'boundary', 'add', 'replace', ...(count === 105 ? ['second-boundary'] : [])]) {
      const date = '2041-01-' + String(10 + scenario++).padStart(2, '0');
      await ev(`(async()=>{for(let i=0;i<${count};i++)await pagingApi('POST','/daily-items',{date:${js(date)},body:'Paging '+i})})()`);
      await ev(`setPage('map');PandoraDaily.goToDate(${js(date)});PandoraDaily.openList(${js(date)})`);
      await ready(`sheetStack.at(-1)?.dailyDate===${js(date)}&&Pandora.idle()`);
      if (mutation === 'second-boundary') await more();
      const before = await ev(`(()=>{sheetBodyEl.scrollTop=600;const e=PandoraDaily.state.lists.get(${js(date)});return {ids:e.items.map(x=>x.id),top:sheetBodyEl.scrollTop,total:e.total,next:e.next}})()`);
      check(`V-006 ${count}/${mutation} starts with a real partial list`, before.ids.length === (mutation === 'second-boundary' ? 100 : 50) && before.next != null, before);
      const index = mutation === 'middle' ? 24 : mutation === 'boundary' ? 49 : mutation === 'second-boundary' ? 99 : 0;
      await ev(`(async()=>{
        ${mutation !== 'add' ? `const item=await pagingApi('GET','/daily-items/'+${js(before.ids[index])});await pagingApi('DELETE','/daily-items/'+item.id,null,item.rowVersion);` : ''}
        ${['add', 'replace'].includes(mutation) ? `await pagingApi('POST','/daily-items',{date:${js(date)},body:'Concurrent addition'});` : ''}
      })()`);
      await more();
      check(`V-006 ${count}/${mutation} preserves list scroll after reconciliation`, Math.abs(await ev('sheetBodyEl.scrollTop') - before.top) < 1);
      check(`V-006 ${count}/${mutation} preserves a visible list focus target`, await ev("sheetBodyEl.contains(document.activeElement)&&document.activeElement.getBoundingClientRect().height>0"));
      for (let page = 0; page < 5 && await ev("!!document.querySelector('[data-action=daily-more]')"); page++) await more();
      const actual = await ev(`(async()=>{
        const items=[];let offset=0,result;
        do{result=await pagingApi('GET','/daily-items?date=${date}&limit=100&offset='+offset);items.push(...result.items);offset=result.nextOffset;}while(offset!=null);
        const entry=PandoraDaily.state.lists.get(${js(date)});
        return {server:items.map(x=>x.id),cached:entry.items.map(x=>x.id),dom:Array.from(document.querySelectorAll('[data-daily-row]')).map(x=>x.dataset.dailyRow),total:entry.total,next:entry.next,more:!!document.querySelector('[data-action=daily-more]')};
      })()`);
      check(`V-006 ${count}/${mutation} finishes with the current server IDs in stable order`,
        JSON.stringify(actual.server) === JSON.stringify(actual.cached) && JSON.stringify(actual.server) === JSON.stringify(actual.dom) && new Set(actual.dom).size === actual.dom.length && actual.total === actual.server.length && actual.next === null && !actual.more, actual);
      await ready(`document.querySelector('[data-daily-date="${date}"]')?.getAttribute('aria-label').includes('未完成${actual.total}条')`);
      check(`V-006 ${count}/${mutation} refreshes the full-day calendar count`, true);
      if (mutation === 'second-boundary') {
        const ids = actual.dom;
        for (const completed of [true, false]) {
          await ev('sheetBodyEl.scrollTop=600');
          await ev("document.querySelector('#sheetBody [data-action=daily-toggle]').click()");
          await ready(`Pandora.idle()&&PandoraDaily.state.lists.get(${js(date)}).items[0].completed===${completed}`);
          check(`V-006 completion=${completed} retains every loaded row in its position`, await ev(`JSON.stringify(PandoraDaily.state.lists.get(${js(date)}).items.map(x=>x.id))===${js(JSON.stringify(ids))}`));
        }
      }
      await ev('closeSheet()');
    }
  }
  const raceDate = '2041-02-01';
  await ev(`(async()=>{for(let i=0;i<105;i++)await pagingApi('POST','/daily-items',{date:${js(raceDate)},body:'Read race '+i})})()`);
  await ev(`PandoraDaily.openList(${js(raceDate)})`);
  await ready(`sheetStack.at(-1)?.dailyDate===${js(raceDate)}&&Pandora.idle()`);
  await more();
  await ev(`window.pagingRequest=Pandora.request;window.pagingHeld=[];window.pagingReads=0;
    Pandora.request=async function(path,options){const result=await pagingRequest(path,options);if(path.startsWith('/daily-items?')&&++pagingReads===1)await new Promise(resolve=>pagingHeld.push(resolve));return result};
    document.querySelector('[data-action=daily-more]').click()`);
  await ready('pagingHeld.length===1');
  await ev(`(async()=>{const item=(await pagingApi('GET','/daily-items?date=${raceDate}&limit=100')).items[0];await pagingApi('DELETE','/daily-items/'+item.id,null,item.rowVersion);await pagingApi('POST','/daily-items',{date:${js(raceDate)},body:'Replacement during read'});pagingHeld.splice(0).forEach(resolve=>resolve())})()`);
  await ready(`Pandora.idle()&&!PandoraDaily.state.lists.get(${js(raceDate)}).loading`);
  const race = await ev(`(async()=>{const first=await pagingApi('GET','/daily-items?date=${raceDate}&limit=100');const last=await pagingApi('GET','/daily-items?date=${raceDate}&limit=100&offset=100');return {server:[...first.items,...last.items].map(x=>x.id),ui:PandoraDaily.state.lists.get(${js(raceDate)}).items.map(x=>x.id),reads:pagingReads}})()`);
  check('V-006 a same-count mutation during a multi-request read triggers reconciliation', JSON.stringify(race.server) === JSON.stringify(race.ui) && race.reads >= 6, race);
  await ev('Pandora.request=pagingRequest;closeSheet()');

  // Start another real page read, close its source, and open a different date.
  await ev(`PandoraDaily.openList('2041-01-10')`);
  await ready("sheetStack.at(-1)?.dailyDate==='2041-01-10'&&Pandora.idle()");
  // This date was completely loaded earlier; force a real refresh through the
  // public reload action before exercising the next page's lifetime.
  await ev("PandoraDaily.action({dataset:{action:'daily-reload',date:'2041-01-10'}})");
  await ready("Pandora.idle()&&!!document.querySelector('[data-action=daily-more]')");
  await ev(`window.pagingHeld=[];Pandora.request=async function(path,options){const result=await pagingRequest(path,options);if(path.startsWith('/daily-items?'))await new Promise(resolve=>pagingHeld.push(resolve));return result};document.querySelector('[data-action=daily-more]').click()`);
  await ready('pagingHeld.length===1');
  await ev("closeSheet();PandoraDaily.openList('2041-03-01')");
  await ready('pagingHeld.length===2');
  await ev('Pandora.request=pagingRequest;pagingHeld.pop()()');
  await ready("sheetStack.at(-1)?.dailyDate==='2041-03-01'&&Pandora.idle()");
  await ev('pagingHeld.splice(0).forEach(resolve=>resolve())');
  await sleep(80);
  check('V-006 a late page read cannot replace the new date or reopen its source', await ev("sheetStack.length===1&&sheetStack[0].dailyDate==='2041-03-01'&&!overlayEl.hidden"));
  await ev('closeSheet()');
  await ev('delete window.pagingApi');
};
