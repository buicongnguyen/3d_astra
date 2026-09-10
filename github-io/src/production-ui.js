import './production-ui.css';
export function createProductionUI(definitions, cancel) {
  const card = document.createElement('section');
  card.id = 'production-status'; card.hidden = true;
  card.setAttribute('aria-label','Production queue');
  card.innerHTML = '<small>PRODUCTION · TAP TO CANCEL</small><div class="production-jobs"></div>';
  document.querySelector('#commands').before(card);
  const jobs = card.querySelector('div');
  let identity = '';
  card.onclick = event => {
    const button = event.target.closest('[data-job]');
    if (button && !button.disabled) cancel(Number(card.dataset.building),Number(button.dataset.job));
  };
  return {update(e, disabled) {
    card.hidden = !(e?.team === 0 && e?.queue.length);
    card.parentElement.classList.toggle('production-open',!card.hidden);
    if(card.hidden)return;
    card.dataset.building=e.id;
    const key=`${e.id}/${e.queue.map(q=>`${q.id}:${q.type}`).join(',')}`;
    if(key!==identity){
      identity=key;
      jobs.innerHTML=e.queue.map(q=>`<button data-job="${q.id}" aria-label="Cancel ${definitions[q.type].name}, full refund"><strong>Cancel ${definitions[q.type].name}</strong><span></span><i></i></button>`).join('');
    }
    for(const button of jobs.children){
      const q=e.queue.find(q=>q.id===Number(button.dataset.job));
      const percent=Math.min(100,Math.floor(q.elapsed/definitions[q.type].time*100));
      button.disabled=disabled;
      button.querySelector('span').textContent=`${q.blocked || (q===e.queue[0]?`${percent}%`:'Queued')} · full refund`;
      button.querySelector('i').style.width=`${percent}%`;
    }
  }};
}
