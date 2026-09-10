import {icon} from './icons.js';
import {buildingActivity} from './activity.js';
import './production-ui.css';

// Work never enters the command list. Reserve one row for every selected building.
export function createWorkStrip(host, definitions, {getSim, canAct, refresh}) {
  host.classList.add('work-strip');
  host.setAttribute('aria-label','Work progress; red strip cancels a job');
  let owner = null, tokens = [];
  return {update(e, disabled) {
    host.hidden = !(e?.team === 0 && e.kind === 'building');
    if (host.hidden) { owner=null; tokens=[]; host.replaceChildren(); return; }
    const sim=getSim(), activity=buildingActivity(sim,e);
    const jobs=!e.complete ? [{kind:'site',ref:e,type:e.type,progress:e.progress,blocked:activity?.waiting?activity.label:''}] : e.levelJob ?
      [{kind:'level',ref:e.levelJob,type:e.type,progress:e.levelJob.elapsed/e.levelJob.time,blocked:''}] :
      e.queue.map(q=>({kind:'train',ref:q,type:q.type,progress:q.elapsed/definitions[q.type].time,blocked:q.blocked}));
    if(owner!==e || jobs.length!==tokens.length || jobs.some((j,i)=>j.ref!==tokens[i])) {
      owner=e; tokens=jobs.map(j=>j.ref); host.replaceChildren();
      jobs.forEach((job,i)=>{
        const button=document.createElement('button');
        button.className='work-job'; button.dataset.kind=job.kind;
        if(job.kind==='train'){button.dataset.job=job.ref.id;button.dataset.cancel=i;}
        if(job.kind==='site')button.dataset.cancelBuild=e.id;
        if(job.kind==='level')button.dataset.cancelLevel='';
        button.innerHTML=`${icon(job.kind==='level'?'shield':definitions[job.type].icon||job.type)}<span class="work-blocks" aria-hidden="true">${'<i></i>'.repeat(10)}</span><span class="work-cancel" aria-hidden="true">×</span>`;
        button.onclick=()=>{
          if(!canAct() || getSim()!==sim || sim.get(e.id)!==e) return;
          if(job.kind==='train'){
            const index=e.queue.indexOf(job.ref); if(index>=0)sim.cancelQueue(e.id,index);
          } else if(job.kind==='level') { if(e.levelJob===job.ref)sim.cancelLevel(e.id); }
          else if(!e.complete)sim.cancelBuilding(e.id);
          refresh();
        };
        host.append(button);
      });
    }
    jobs.forEach((job,i)=>{
      const button=host.children[i], progress=Math.max(0,Math.min(1,job.progress));
      const name=job.kind==='level'?`Upgrade L${e.level+1}`:definitions[job.type].name;
      const refund=job.kind==='site'?'75% refund':'full refund';
      const label=`Cancel ${name}${job.kind==='train'?`, queue item ${i+1}`:''}, ${Math.floor(progress*100)}%, ${refund}${job.blocked?`, ${job.blocked}`:''}`;
      button.title=label; button.setAttribute('aria-label',label); button.disabled=disabled;
      button.dataset.progress=String(progress); button.dataset.waiting=String(!!job.blocked);
      [...button.querySelectorAll('.work-blocks i')].forEach((cell,n)=>cell.classList.toggle('filled',n<Math.ceil(progress*10)));
    });
  }};
}

export function createProductionUI(definitions, callbacks) {
  const host=document.createElement('section');host.id='production-status';host.hidden=true;
  document.querySelector('#commands').before(host);
  return createWorkStrip(host,definitions,callbacks);
}
