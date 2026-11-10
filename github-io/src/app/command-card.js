// Order buttons, command tiles, tooltip line, production and construction panels.
import { $ } from "./dom.js";
import { DEFINITIONS as D } from "../data.js";
import { createConstructionUI } from "../construction-ui.js";
import { createProductionUI, createWorkStrip } from "../production-ui.js";
import { icon } from "../icons.js";

export function setupCommandCard(S, A) {
  const Z = S.screen;
  const workCallbacks={getSim:()=>S.sim,canAct:()=>Z.started&&!Z.paused&&!S.sim.result,refresh:A.updateUI};

  const productionUI=createProductionUI(D,workCallbacks);

  const selectionWorkUI=createWorkStrip(document.querySelector('#queue'),D,workCallbacks);

  // Command card tooltip line: names the hovered order or tile above the card, as RTS consoles do.
  // While it shows, the title moves to data-tip so the browser tooltip does not repeat it.
  let tipButton = null;

  function showOrderTip(button) {
    if (tipButton && tipButton !== button && tipButton.dataset.tip) {
      tipButton.title = tipButton.dataset.tip;
      delete tipButton.dataset.tip;
    }
    tipButton = button && !document.documentElement.classList.contains('compact-ui') ? button : null;
    if (tipButton?.title) {
      tipButton.dataset.tip = A.localization.sourceAttribute(tipButton, 'title');
      tipButton.removeAttribute('title');
    }
    $('order-tip').hidden = !tipButton?.dataset.tip;
    if (tipButton) $('order-tip').textContent = tipButton.dataset.tip;
  }

  let constructionUI;

  Object.assign(A, { productionUI, selectionWorkUI });
  return function bind() {
    $("confirm-build").onclick = () => A.confirmBuild();

    $("cancel-mode").onclick = () => { A.clearMode(); A.updateUI(); };

    $("field-guide").onclick = () => A.showGuide(A.selectedEntities()[0]?.type);

    $("support-order").onclick = () => A.enterMode('support');

    for(const [id,key] of [['field-guide','I'],['support-order','R'],['move-order','M']]) {
      $(id).insertAdjacentHTML('beforeend',` <kbd>${key}</kbd>`);$(id).title+=` · ${key}`;
    }

    {
      const card = document.querySelector('.command-panel'), target = event => event.target.closest('button[title],button[data-tip]');
      card.addEventListener('pointerover', event => showOrderTip(target(event)));
      card.addEventListener('focusin', event => showOrderTip(target(event)));
      card.addEventListener('pointerleave', () => showOrderTip(null));
      card.addEventListener('focusout', () => showOrderTip(null));
    }

    $("upgrade-actions").onclick = event => {
      if (!Z.started || Z.paused || S.sim.result) return;
      const e = A.selectedEntities()[0];
      if (!e) return;
      if (event.target.closest('[data-level]')) S.sim.command({team:0,type:"upgrade",building:e.id});
      if (event.target.closest('[data-cancel-level]')) S.sim.command({team:0,type:"cancelUpgrade",building:e.id});
      A.updateUI();
    };

    $("move-order").onclick = () => A.enterMode("move");

    $("attack-order").onclick = () => A.enterMode("attackmove");

    $("attack-order").insertAdjacentHTML('afterend', `<button id="patrol-order" hidden title="Patrol between two points · P">${icon("patrol","desk")}<span class="order-label">Patrol</span> <kbd>P</kbd></button><button id="attack-target-order" hidden title="Attack a chosen enemy · N">${icon("attack","desk")}<span class="order-label">Attack</span> <kbd>N</kbd></button>`);

    $("patrol-order").onclick = () => A.enterMode('patrol');

    $("attack-target-order").onclick = () => A.enterMode('attack');

    $("stop-order").onclick = () => A.runShortcut('stop');

    $("stop-order").insertAdjacentHTML('afterend', `<button id="repair-order" hidden title="Repair a damaged building (or right-click it) · costs a quarter of its price for a full repair">${icon("engineer","desk")}<span class="order-label">Repair</span></button><button id="rally-order" hidden title="Rally point: new units gather here; on a deposit, new Harvesters start mining · L">${icon("flag","desk")}<span class="order-label">Rally</span> <kbd>L</kbd></button>`);

    $("repair-order").onclick = () => A.enterMode('repair');

    $("rally-order").onclick = () => A.enterMode('rally');

    $("commands").onclick = (event) => {
      const ability = event.target.closest("[data-ability]"), stance = event.target.closest("[data-stance]");
      if (ability) { if (!ability.disabled) A.useAbility(ability.dataset.ability); return; }
      if (stance) { if (!stance.disabled) A.setStance(stance.dataset.stance); return; }
      const button = event.target.closest("[data-action]");
      if (!button || button.disabled) return;
      const type = button.dataset.action;
      if (D[type].kind === "building") A.enterBuild(type);
      else {
        const b = A.selectedEntities()[0];
        if (b) {
          S.sim.command({ team: 0, type: "train", building: b.id, unit: type });
          A.tone();
          A.updateUI();
        }
      }
    };

    constructionUI = createConstructionUI(D, {
      retry: type => A.enterBuild(type),
      back: () => { A.clearMode(); A.updateUI(); },
    });
    A.constructionUI = constructionUI;
  };
}
