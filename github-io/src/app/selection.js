// Selection, control groups and screen-wide selection helpers.
import { $ } from "./dom.js";
import { icon } from "../icons.js";
import { squadRole } from "../sim/formation.js";

// R3-B: how long a press on a numbered group chip saves the selection into it.
export const HOLD_MS = 500;

export function setupSelection(S, A) {
  const Z = S.screen;
  function selectedEntities() {
    return [...S.selected].map((id) => S.sim.get(id)).filter((e) => e?.team === 0);
  }

  function setSelection(ids) {
    A.clearMode();
    S.selected = new Set(ids);
    S.lastSelectionKey = "";
    A.updateUI();
    if (document.documentElement.classList.contains("compact-ui")) {
      const es = selectedEntities();
      A.dockTab(
        es.length === 1 && (es[0].trains || es[0].type === "worker" || (es[0].kind === 'building' && !es[0].complete))
          ? "actions"
          : "selection",
      );
    }
    A.tone(650);
  }

  let lastGroup = { key: '', time: 0 };

  let groupStripHtml = '';

  function focusSelection() {
    const es=selectedEntities();
    if(es.length) S.view.focusOn(es.reduce((s,e)=>s+e.x,0)/es.length,es.reduce((s,e)=>s+e.z,0)/es.length);
  }

  function groupMembers(key) {
    return (S.groups.get(key) || []).filter(id => S.sim.get(id)?.team === 0);
  }

  // R3-B smart chips (phones): the whole army, its fighters, or its support units and flyers.
  function smartMembers(kind) {
    const army = S.sim.own(0).filter((e) => e.kind === "unit" && e.type !== "worker" && e.complete !== false);
    return army.filter((e) => kind === "army" || (kind === "support") === (squadRole(e) === "support" || !!e.flying)).map((e) => e.id);
  }
  function smartChips() {
    if (!document.documentElement.classList.contains("compact-ui") || !Z.started || S.sim.defence) return "";
    const same = (ids) => ids.length && ids.length === S.selected.size && ids.every((id) => S.selected.has(id));
    const chip = (kind, label, glyph, title) => {
      const ids = smartMembers(kind);
      return ids.length ? `<button type="button" data-smart="${kind}" class="smart${same(ids) ? " active" : ""}" title="${title}">${icon(glyph)}<span>${label}</span></button>` : "";
    };
    const free = S.selected.size ? [1, 2, 3, 4, 5, 6, 7, 8, 9].map(String).find((key) => !groupMembers(key).length) : null;
    return chip("army", "All army", "people", "Select every army unit")
      + chip("fighters", "Fighters", "crosshair", "Select every fighter")
      + chip("support", "Support", "medic", "Select Medics, Engineers and flyers")
      + (free ? `<button type="button" data-save-group="${free}" class="save" title="Save the selection as group ${free} (hold a group to save over it)"><span>+ Group ${free}</span></button>` : "");
  }

  // Assigned control groups as tabs on the console, with a unit icon and live count.
  function renderGroupStrip() {
    const tabs = [...S.groups.keys()].sort().map(key => [key, groupMembers(key)]).filter(([, ids]) => ids.length);
    const html = smartChips() + tabs.map(([key, ids]) => {
      const lead = S.sim.get(ids[0]), active = ids.length === S.selected.size && ids.every(id => S.selected.has(id));
      return `<button data-group="${key}" class="${active ? "active" : ""}" title="Group ${key} · ${ids.length} ${ids.length === 1 ? "unit" : "units"} — click or press ${key} to recall, Ctrl-click to save, Shift-click to add"><kbd>${key}</kbd>${icon(lead.icon || lead.type)}<span>${ids.length}</span></button>`;
    }).join("");
    // R3-B: on phones the strip is the top of the "…" sheet, in reach with or without a selection, at no
    // cost to the battlefield while the sheet is closed and with no growth of the fixed dock; on PC it
    // stays the console tabs above the selection panel.
    const strip = $("group-strip"), compact = document.documentElement.classList.contains("compact-ui");
    if (compact && strip.parentElement !== $("touch-sheet")) $("touch-sheet").prepend(strip);
    else if (!compact && !strip.closest(".selection-panel")) document.querySelector(".selection-panel").prepend(strip);
    // Rebuild only on change so a click is never lost to a re-render between press and release.
    if (groupStripHtml !== html) strip.innerHTML = groupStripHtml = html;
  }

  function useGroup(key, assign=false, add=false) {
    if(assign) S.groups.set(key,[...S.selected]);
    else if(add) S.groups.set(key,[...new Set([...(S.groups.get(key)||[]),...S.selected])]);
    else {
      const live=(S.groups.get(key)||[]).filter(id=>S.sim.get(id)?.team===0);
      if(!live.length) { S.groups.delete(key); renderGroupStrip(); return; }
      setSelection(live);
      if(lastGroup.key===key && performance.now()-lastGroup.time<400) focusSelection();
      lastGroup={key,time:performance.now()};
    }
    if(assign||add) A.notice(`Control group ${key} ${add?'extended':'assigned'}.`);
    renderGroupStrip();
  }

  function selectScreenType(target,additive=false) {
    const canvas=S.view.renderer.domElement,r=canvas.getBoundingClientRect();
    const same=S.sim.own(0).filter(u=>{
      if(u.type!==target.type)return false;
      const p=S.view.project(u.x,u.z,S.view.liftOf(u)),x=p.x+r.left,y=p.y+r.top;
      return x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom&&document.elementFromPoint(x,y)===canvas;
    });
    const next=additive?new Set(S.selected):new Set(),remove=additive&&S.selected.has(target.id);
    for(const u of same){if(remove)next.delete(u.id);else next.add(u.id);}
    setSelection(next);
  }

  function selectHome() {
    const own = S.sim.own(0), hq = own.find((e) => e.type === "hq");
    setSelection(hq ? [hq.id] : own.filter((e) => e.kind === "unit" && e.type !== "worker").map((e) => e.id));
  }

  Object.assign(A, { selectedEntities, renderGroupStrip, setSelection, focusSelection, useGroup, selectScreenType, groupMembers, selectHome });
  return function bind() {
    $("select-workers").onclick = () => {
      A.clearMode();
      setSelection(
        S.sim
          .own(0)
          .filter((e) => e.type === "worker")
          .map((e) => e.id),
      );
      A.dockTab("actions");
    };

    $("select-army").onclick = () => {
      A.clearMode();
      setSelection(
        S.sim
          .own(0)
          .filter((e) => e.kind === "unit" && e.type !== "worker")
          .map((e) => e.id),
      );
    };

    $("clear-selection").onclick = () => {
      A.clearMode();
      setSelection([]);
    };

    $('group-strip').onclick=event=>{
      const live=Z.started&&!Z.paused&&!S.sim.result;
      // R3-B: a hold already saved the group; the click that ends it must not recall it.
      if(held){held=false;return;}
      const smart=event.target.closest('[data-smart]'),save=event.target.closest('[data-save-group]');
      if(smart&&live){A.clearMode();setSelection(smartMembers(smart.dataset.smart));return;}
      if(save&&live&&S.selected.size){useGroup(save.dataset.saveGroup,true);return;}
      const group=event.target.closest('[data-group]');
      if(group&&live)useGroup(group.dataset.group,event.ctrlKey||event.metaKey,event.shiftKey);
    };
    // R3-B: hold a numbered chip for 500 ms to save the current selection into it (phones have no Ctrl).
    let holdTimer=0,held=false;
    const endHold=()=>{clearTimeout(holdTimer);holdTimer=0;};
    $('group-strip').addEventListener('pointerdown',event=>{
      const group=event.target.closest('[data-group]');
      held=false;endHold();
      if(!group||!S.selected.size||!Z.started||Z.paused||S.sim.result)return;
      holdTimer=setTimeout(()=>{holdTimer=0;held=true;useGroup(group.dataset.group,true);},HOLD_MS);
    });
    for(const type of ['pointerup','pointercancel','pointerleave'])$('group-strip').addEventListener(type,endHold);
    $('group-strip').addEventListener('contextmenu',event=>{if(event.target.closest('[data-group]'))event.preventDefault();});

    $("unit-list").onclick = (event) => {
      const button = event.target.closest("[data-select]");
      if (button) setSelection([Number(button.dataset.select)]);
    };
  };
}
