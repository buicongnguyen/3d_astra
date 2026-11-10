// Keyboard shortcuts (runShortcut), key handling and pausing when the page loses focus.
import { $ } from "./dom.js";
import { physicalKey, ACTION_KEYS, HOTKEYS } from "../hotkeys.js";

export function setupInputKeyboard(S, A) {
  const Z = S.screen;
  function runShortcut(id) {
    if(id==='pause') {A.togglePause();return;}
    if(!Z.started||Z.paused||S.sim.result) return;
    const es=A.selectedEntities(),e=es[0],own=S.sim.own(0);
    const choose=(items,cycle=false)=>{
      if(!items.length){A.notice('No matching units or buildings.');return;}
      const next=cycle?items[(items.findIndex(u=>u.id===e?.id)+1)%items.length]:null;
      A.setSelection(next?[next.id]:items.map(u=>u.id));
      if(cycle)A.focusSelection();
    };
    if(id==='build') {
      if(!es.some(u=>u.type==='worker')) choose(own.filter(u=>u.type==='worker').sort((a,b)=>a.orders.length-b.orders.length).slice(0,1));
      if(A.selectedEntities().some(u=>u.type==='worker')) {A.clearMode();A.dockTab('actions');A.notice('BUILD: Q Relay · E Barracks · R Foundry · T Tower · Y Core');}
    } else if(['move','attackmove','patrol','attack','support','context','rally'].includes(id)) A.enterMode(id);
    else if(id.startsWith('stance-')) A.setStance(id.slice(7), true);
    else if(id==='stop') {A.clearMode();A.sendOrder([...S.selected],{type:'stop'});A.notice('Orders cleared.');}
    else if(id==='deliver') {
      const ws=es.filter(u=>u.type==='worker'&&u.carry>0);
      if(ws.length){A.clearMode();A.sendOrder(ws.map(u=>u.id),{type:'deliver'},S.queueOrders);}
      else A.notice('Select Harvesters carrying resources.');
    } else if(id==='upgrade') {if(e?.kind==='building')S.sim.command({team:0,type:"upgrade",building:e.id});else A.notice('Select a building to upgrade.');}
    else if(id==='cancel') {
      if(S.mode || S.blockedBuildType)A.clearMode();
      else if(e?.kind==='building') {
        if(!e.complete)S.sim.command({team:0,type:"cancelBuild",building:e.id});
        else if(e.levelJob)S.sim.command({team:0,type:"cancelUpgrade",building:e.id});
        else if(e.queue.length)S.sim.command({team:0,type:"cancelTrain",building:e.id,index:e.queue.length-1});
        else A.notice('No queued job to cancel.');
      }
    } else if(id==='idle')A.cycleIdle('worker');
    else if(id==='idle-army')A.cycleIdle('army');
    else if(id==='army')choose(own.filter(u=>u.kind==='unit'&&u.type!=='worker'));
    else if(id==='workers')choose(own.filter(u=>u.type==='worker'));
    else if(id==='buildings')choose(own.filter(u=>u.kind==='building'));
    else if(['hq','barracks','foundry'].includes(id))choose(own.filter(u=>u.type===id),true);
    else if(id==='same'&&e)choose(own.filter(u=>u.type===e.type));
    else if(id==='all')choose(own.filter(u=>u.kind==='unit'));
    else if(id==='clear')A.setSelection([]);
    else if(id==='focus')A.focusSelection();
    else if(id==='queue')$('queue-orders').click();
    else if(id==='info')A.showGuide(e?.type);
    else if(id==='zoom-in')S.view.zoomBy(-4);
    else if(id==='zoom-out')S.view.zoomBy(4);
    A.updateUI();
  }

  function bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if(A.settingsUI.active || Z.modalType==='guide' || e.isComposing ||
        (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
      const key=physicalKey(e);
      if(e.altKey||e.metaKey) return;
      if(e.ctrlKey && !/^[1-9]$/.test(key) && key!=='a')return;
      if(key==='escape') {
        if(e.repeat)return;
        e.preventDefault();S.keys.clear();
        if(Z.modalType==='fullscreen')A.closeModal();
        else if(document.documentElement.classList.contains('objectives-open'))A.setObjectivesOpen(false);
        else if(S.mode || S.blockedBuildType)A.clearMode();
        else if(Z.modalType==='help')A.closeModal();
        else if(Z.started&&!S.sim.result)A.togglePause();
        return;
      }
      if(key===' '&&!e.ctrlKey) {
        if(e.target instanceof Element && e.target.closest('#mission-toggle'))return;
        // Before play, Space must activate the focused Start/Settings button.
        if(!Z.started && e.target instanceof Element && e.target.closest('button'))return;
        // Inside a modal, Space activates the focused button natively.
        if(Z.modalType && e.target instanceof Element && e.target.closest('#modal button'))return;
        e.preventDefault();if(!e.repeat) {S.keys.clear();if(Z.modalType==='pause')A.closeModal();else if(!Z.modalType)A.togglePause();}return;
      }
      if(Z.modalType||!Z.started||Z.paused||S.sim.result)return;
      if(/^[1-9]$/.test(key)) {
        e.preventDefault();if(!e.repeat)A.useGroup(key,e.ctrlKey,e.shiftKey);return;
      }
      if(e.ctrlKey&&key==='a') {e.preventDefault();if(!e.repeat)runShortcut('all');return;}
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {e.preventDefault();S.keys.add(key);return;}
      const tile=ACTION_KEYS.includes(key.toUpperCase()) ? document.querySelector(`#commands [data-hotkey="${key.toUpperCase()}"]`) : null;
      if(tile&&!S.mode) {e.preventDefault();if(!e.repeat&&!tile.disabled)tile.click();return;}
      const binding=HOTKEYS.find(k=>k.key.split(' / ')[0].toLowerCase()===key);
      const id=key==='.'?'idle':key==='-'?'zoom-out':key==='q'&&!S.mode?'attackmove':binding?.id;
      if(id) {e.preventDefault();if(!e.repeat)runShortcut(id);return;}
      if(key==='?'){e.preventDefault();if(!e.repeat){S.keys.clear();A.showHelp();}}
      if(key==='g'&&!e.repeat)S.view.grid.visible=!S.view.grid.visible;
    });
    window.addEventListener("keyup",e=>S.keys.delete(physicalKey(e)));
    const suspendInput = () => {
      S.touchControls.reset();
      S.drag = null;
      S.pointer.inside = false;
      S.keys.clear();
      $("selection-box").style.display = "none";
      // Safari/embedded browsers can blur before visibilitychange or pagehide.
      // Stay paused on return, so an interrupted gesture cannot issue an order.
      // Only a running match pauses: an open modal, settings or the guide already hold it.
      if (Z.started && !Z.paused && !S.sim.result && !Z.modalType && !A.settingsUI.active) A.togglePause();
    };
    window.addEventListener("blur", suspendInput);
    window.addEventListener("pagehide", suspendInput);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) suspendInput();
    });
  }

  Object.assign(A, { runShortcut, bindKeyboard });
  return function bind() {};
}
