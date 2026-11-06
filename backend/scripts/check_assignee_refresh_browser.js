'use strict';
const {waitFor}=require('./browser_fixture');

// Real administration followed by the same authenticated employee's create/edit picker.
module.exports=async function checkAssigneeRefresh(b,f,check,login){
 const ev=b.evaluate,q=JSON.stringify,id=f.employeeId;
 async function api(method,path,body,version){
  const headers={Authorization:'Bearer '+f.adminToken,'Content-Type':'application/json'};
  if(method!=='GET')headers['Idempotency-Key']=crypto.randomUUID();
  if(version!==undefined)headers['If-Match']='"'+version+'"';
  const response=await fetch(f.base+'/api/v1'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error('selector fixture '+method+' '+path+' '+response.status+' '+result.code);
  return result;
 }
 async function close(){await ev('closeSheet()');}
 async function form(mode){await ev(mode==='create'?"openTaskForm('create')":`openTaskForm('edit',${q(f.pinTask)})`);}
 async function search(name){
  await ev(`document.getElementById('ap-search').value=${q(name)};document.getElementById('ap-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  return ev(`(()=>{const row=document.querySelector('[data-pick-person="${id}"]');return row?{name:row.parentElement.querySelector('strong').textContent,meta:row.parentElement.querySelector('small').textContent}:null})()`);
 }
 // Populate both caches before changing anything on the server.
 for(const mode of ['create','edit']){await form(mode);await ev('openAssigneePicker()');await close();await close();}
 const employee=await api('GET','/admin/employees/'+id);
 await api('PATCH','/admin/employees/'+id,{displayName:'Refreshed selector employee'},employee.rowVersion);
 const position=await api('POST','/admin/positions',{name:'Refreshed selector position'});
 const draft=await api('GET','/admin/organization-plans');
 const plan=Object.fromEntries(['departments','teams','placements','expectedEmployees'].map(key=>[key,draft[key]]));
 const target=plan.placements.find(p=>p.employeeId===id),head=plan.placements.find(p=>p.employeeId===f.replacementHeadId);
 const old={...target};
 Object.assign(target,{placementType:head.placementType,departmentId:head.departmentId,teamId:head.teamId,positionId:position.positionId});
 Object.assign(head,{placementType:old.placementType,departmentId:old.departmentId,teamId:old.teamId,positionId:old.positionId});
 const removed=await api('GET','/admin/employees/'+f.removedCandidateId);
 plan.placements=plan.placements.filter(p=>p.employeeId!==f.removedCandidateId);
 plan.deactivateEmployees=[{employeeId:f.removedCandidateId,rowVersion:removed.rowVersion,reason:'Selector removal regression'}];
 plan.reason='Selector organization refresh regression';
 await api('POST','/admin/organization-plans',plan,draft.rowVersion);
 await ev('Pandora.reload()');
 for(const mode of ['create','edit']){
  await form(mode);
  const selected=mode==='create'?[f.founderId,id]:[id];
  if(mode==='create')await ev(`drafts.task.assigneeIds=${q(selected)}`);
  await ev('openAssigneePicker()');
  const row=await search('Refreshed selector employee');
  check(mode+' picker searches refreshed name and shows current identity position department and team',
    row&&row.name==='Refreshed selector employee'&&['团队负责人','Refreshed selector position','beta','beta one'].every(value=>row.meta.includes(value)),row);
  check(mode+' picker preserves ordered legal selections',await ev(`JSON.stringify(assigneePicker.selected)===${q(JSON.stringify(selected))}`));
  check(mode+' cache no longer contains a deactivated candidate',await ev(`!assignablePeople(actor()).some(p=>p.id===${q(f.removedCandidateId)})`));
  check(mode+' picker no longer matches the old name',await search('alpha-one-employee')===null);
  await close();await close();
 }
 // A later safe upsert must also reach selectors without keeping detached person objects.
 await form('create');
 await ev(`Pandora.rememberPeople([{id:${q(id)},displayName:'Current safe summary'}]);openAssigneePicker()`);
 check('cached candidate IDs resolve current safe person data',(await search('Current safe summary'))?.name==='Current safe summary');
 await close();await close();

 async function holdCandidate(){
  await ev('Pandora.reload()');
  await ev(`(()=>{
   const real=Pandora.request;window.__selectorRealRequest=real;window.__releaseCandidate=null;
   Pandora.request=async function(path,options){
    const data=await real(path,options);
    if(path==='/assignee-candidates?purpose=create'){
     await new Promise(resolve=>{window.__releaseCandidate=resolve;});
    }
    return data;
   };
   window.__candidateOpen=openTaskForm('create');
  })()`);
  check('candidate response is deliberately held after its authenticated read',await waitFor(b,"typeof window.__releaseCandidate==='function'"));
 }
 async function releaseCandidate(){
  await ev('Pandora.request=window.__selectorRealRequest;window.__releaseCandidate();window.__candidateOpen');
 }
 await holdCandidate();
 const updated=await api('GET','/admin/employees/'+id);
 await api('PATCH','/admin/employees/'+id,{displayName:'Newest selector employee'},updated.rowVersion);
 await ev('Pandora.reload()');
 await releaseCandidate();
 check('late candidate response cannot overwrite personnel after a newer reload',await ev(`personById(${q(id)}).name==='Newest selector employee'&&document.getElementById('overlay').hidden`));
 await form('create');await ev('openAssigneePicker()');
 check('reopening after a discarded response fetches current candidates',(await search('Newest selector employee'))?.name==='Newest selector employee');
 await close();await close();
 await holdCandidate();
 await ev('Pandora.logout()');
 await releaseCandidate();
 check('late candidate response after logout cannot repopulate personnel',await ev('PEOPLE.length===0&&document.getElementById("overlay").hidden'));
 await login(f.employee);
 check('late candidate response cannot restore an old account form or scope',await ev(`Pandora.data.me.id===${q(id)}&&document.getElementById('overlay').hidden&&assignablePeople(actor()).length===0`));
 await ev('Pandora.logout()');await login(f.founder);
};
