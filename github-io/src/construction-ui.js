import './construction-ui.css';

// Keep mobile construction feedback together in the Actions dock. The existing
// placement buttons are moved, not duplicated, so mouse and touch share handlers.
export function createConstructionUI(definitions, { retry, back, cancelSite }) {
  const host = document.querySelector('.command-panel');
  const controls = document.querySelector('#mode-controls');
  const stage = document.querySelector('#stage');
  const toast = document.querySelector('#notice');
  const card = document.createElement('section');
  card.id = 'construction-status';
  card.hidden = true;
  card.setAttribute('aria-label', 'Construction status');
  card.innerHTML = `<div class="construction-copy">
    <h3 id="construction-title"></h3><p id="construction-cost"></p>
    <div id="construction-progress" hidden><strong id="construction-percent"></strong>
      <div class="construction-track" role="progressbar" aria-label="Construction progress" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>
    <p id="construction-message" role="status" aria-live="polite"></p>
    </div><div id="construction-actions">
    <button id="construction-retry">Choose location</button>
    <button id="construction-back">Back to buildings</button>
    <button id="construction-cancel">Cancel build · 75% refund</button></div>`;
  host.append(card);
  const get = id => card.querySelector(`#construction-${id}`);
  const put = (id, text) => { if (get(id).textContent !== text) get(id).textContent = text; };
  get('retry').onclick = () => retry(card.dataset.type);
  get('back').onclick = back;
  get('cancel').onclick = () => cancelSite(Number(card.dataset.site));

  return {
    update({ sim, selected, mode, type, point, blockedType, failure, started, paused, touch }) {
      const placing = mode === 'build';
      const site = selected.length === 1 && selected[0].kind === 'building' && !selected[0].complete && selected[0].hp > 0 ? selected[0] : null;
      const visible = document.documentElement.classList.contains('compact-ui') &&
        document.documentElement.dataset.dock === 'actions' && started && !sim.result && (placing || blockedType || site);
      card.hidden = !visible;
      host.classList.toggle('construction-open', !!visible);
      document.documentElement.classList.toggle('construction-open', !!visible);
      if (!visible) {
        document.documentElement.classList.remove('construction-notice-repeated');
        if (controls.parentElement === card) stage.append(controls);
        return;
      }
      const kind = placing ? 'placement' : blockedType ? 'requirements' : 'progress';
      const definition = definitions[placing ? type : blockedType || site.type];
      const identity = `${kind}/${definition.name}/${site?.id || ''}`;
      if (card.dataset.identity !== identity) get('title').parentElement.scrollTop = 0;
      card.dataset.identity = identity;
      card.dataset.type = placing ? type : blockedType || site.type;
      card.dataset.site = site?.id || '';
      put('title', definition.name);
      put('cost', `${kind === 'progress' ? 'Paid' : 'Cost'}: ${definition.cost[0]} alloy${definition.cost[1] ? ` · ${definition.cost[1]} energy` : ''}`);
      get('cost').hidden = kind === 'progress';
      get('progress').hidden = kind !== 'progress';
      get('retry').hidden = kind !== 'requirements';
      get('back').hidden = kind !== 'requirements';
      get('cancel').hidden = kind !== 'progress';
      get('actions').hidden = kind === 'placement';
      if (placing) {
        if (controls.parentElement !== card) card.append(controls);
      }
      else if (controls.parentElement === card) stage.append(controls);

      let message, warning = false;
      if (kind === 'placement' || kind === 'requirements') {
        const worker = selected.some(e => e.type === 'worker');
        const error = !worker ? 'Select a Harvester to construct this building.' :
          (kind === 'placement' && point ? sim.placement(type, 0, point.x, point.z) : sim.constructionRequirements(card.dataset.type)) || failure;
        warning = !!error;
        message = error || (kind === 'requirements' ? 'Requirements met. Choose a location to continue.' :
          point ? `${touch ? 'Tap Build here' : 'Click the site'} to start construction.` : `${touch ? 'Tap clear ground to choose a site.' : 'Click clear ground to build.'}`);
        get('retry').disabled = !!error || paused;
        if (placing) controls.querySelector('#confirm-build').disabled = !point || !!error || paused;
      } else {
        const percent = Math.floor(site.progress * 100);
        put('percent', `Construction · ${percent}%`);
        const track = get('progress').querySelector('[role="progressbar"]');
        track.setAttribute('aria-valuenow', String(percent));
        track.querySelector('i').style.width = `${percent}%`;
        const builders = sim.own(0).filter(e => e.type === 'worker' && e.orders[0]?.type === 'build' && e.orders[0]?.target === site.id);
        warning = !builders.length;
        message = !builders.length ? `Waiting for a Harvester. Select Workers, then ${touch ? 'tap' : 'right-click'} this site to continue.` :
          builders.some(e => Math.hypot(e.x - site.x, e.z - site.z) <= site.radius + 2.2) ? 'Building in progress. Keep a Harvester at the site.' : 'Harvester travelling to the site.';
      }
      put('message', message);
      const repeatedNotice = toast.textContent === message ||
        (kind === 'progress' && toast.textContent === `${definition.name} construction started.`);
      document.documentElement.classList.toggle('construction-notice-repeated', repeatedNotice);
      if (repeatedNotice) toast.classList.remove('show');
      card.dataset.warning = String(warning);
      get('cancel').disabled = paused;
    },
  };
}
