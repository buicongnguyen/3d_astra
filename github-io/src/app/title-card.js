// Mission title card (AAA round 2, W2-F): "ACT I · LANDFALL · DAY 1", the title and the place, over the
// top third of the battlefield for 2.6 s as a mission begins. It never blocks play: only the card itself
// takes a tap (a tap skips it), it sits clear of the dock, the dialogue and the tool rows, and a scene
// hides it. Under reduced motion it only fades. Data: src/story/mission-intros.js.
import "../title-card.css";
import { reducedMotion } from "../reduced-motion.js";
import { titleCardFor } from "../story/mission-intros.js";
import { motionOff } from "./preferences.js";

export const TITLE_CARD_SECONDS = 2.6;
let card = null, timer = 0;

export function hideTitleCard() {
  clearTimeout(timer);
  card?.remove();
  card = null;
}

// Shows the card for `def` (a mission or Defence level). Returns false when there is nothing to show.
export function showTitleCard(def, host = document.getElementById("world") || document.body) {
  const info = titleCardFor(def);
  hideTitleCard();
  if (!info) return false;
  card = document.createElement("div");
  card.id = "title-card";
  card.setAttribute("role", "status");
  card.innerHTML = `${info.kicker ? `<span class="tc-kicker"></span>` : ""}<strong class="tc-title"></strong>${info.place ? `<span class="tc-place"></span>` : ""}`;
  if (info.kicker) card.querySelector(".tc-kicker").textContent = info.kicker;
  card.querySelector(".tc-title").textContent = info.title;
  if (info.place) card.querySelector(".tc-place").textContent = info.place;
  // Reduced motion: no slide, only a short opacity fade in and out (a transition, since motion-off silences animations).
  const calm = motionOff() || reducedMotion();
  if (calm) card.classList.add("calm");
  card.addEventListener("pointerdown", (e) => { e.stopPropagation(); hideTitleCard(); });
  host.append(card);
  if (calm) {
    const mine = card;
    requestAnimationFrame(() => mine.classList.add("show"));
    setTimeout(() => mine.classList.remove("show"), (TITLE_CARD_SECONDS - 0.4) * 1000);
  }
  timer = setTimeout(hideTitleCard, TITLE_CARD_SECONDS * 1000);
  return true;
}
