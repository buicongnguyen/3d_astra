import './construction-ui.css';

// Keep mobile construction feedback together in the Actions dock. The existing
// placement buttons are moved, not duplicated, so mouse and touch share handlers.
export function createConstructionUI(definitions, { retry, back }) {
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
    <p id="construction-message" role="status" aria-live="polite"></p>
    </div><div id="construction-actions">
    <button id="construction-retry">Choose location</button>
    <button id="construction-back">Back to buildings</button></div>`;
  host.append(card);
  const get = id => card.querySelector(`#construction-${id}`);
  const put = (id, text) => { if (get(id).textContent !== text) get(id).textContent = text; };
  get('retry').onclick = () => retry(card.dataset.type);
  get('back').onclick = back;

  return {
    update({ sim, selected, mode, type, point, blockedType, failure, started, paused, touch }) {
      const placing = mode === 'build';
      const visible = document.documentElement.classList.contains('compact-ui') &&
        document.documentElement.dataset.dock === 'actions' && started && !sim.result && (placing || blockedType);
      card.hidden = !visible;
      host.classList.toggle('construction-open', !!visible);
      document.documentElement.classList.toggle('construction-open', !!visible);
      if (!visible) {
        document.documentElement.classList.remove('construction-notice-repeated');
        if (controls.parentElement === card) stage.append(controls);
        return;
      }
      const kind = placing ? 'placement' : 'requirements';
      const definition = definitions[placing ? type : blockedType];
      const identity = `${kind}/${definition.name}`;
      if (card.dataset.identity !== identity) get('title').parentElement.scrollTop = 0;
      card.dataset.identity = identity;
      card.dataset.type = placing ? type : blockedType;
      put('title', definition.name);
      put('cost', `Cost: ${definition.cost[0]} alloy${definition.cost[1] ? ` · ${definition.cost[1]} energy` : ''}`);
      get('retry').hidden = kind !== 'requirements';
      get('back').hidden = kind !== 'requirements';
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
      }
      put('message', message);
      const repeatedNotice = toast.textContent === message;
      document.documentElement.classList.toggle('construction-notice-repeated', repeatedNotice);
      if (repeatedNotice) toast.classList.remove('show');
      card.dataset.warning = String(warning);
    },
  };
}
