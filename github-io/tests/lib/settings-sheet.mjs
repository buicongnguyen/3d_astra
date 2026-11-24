// The unified settings sheet (2026-11-24): one gear (#briefing-settings, title bar and match bar) or
// Pause → Settings opens it; seven section tabs; segmented buttons ([data-setting][data-value]); every
// change applies and saves at once; Done or the close button shuts it. Language, theme and full screen live
// only here. These helpers keep the browser suites short.

const press = async (page, selector, touch) => {
  const target = page.locator(selector).first();
  if (touch) await target.tap(); else await target.click();
};
const isTouch = (page) => page.evaluate(() => matchMedia("(pointer:coarse)").matches);

// Opens the sheet on a section (from the gear unless it is already open).
export async function openSettings(page, tab, { touch } = {}) {
  touch ??= await isTouch(page);
  if (await page.locator(".settings-backdrop").isHidden()) await press(page, "#briefing-settings", touch);
  await page.locator(".settings-panel").waitFor({ state: "visible" });
  if (tab) await press(page, `#settings-tab-${tab}`, touch);
}

export async function closeSettings(page, { touch } = {}) {
  touch ??= await isTouch(page);
  if (await page.locator(".settings-backdrop").isHidden()) return;
  await press(page, '.settings-panel [data-do="done"]', touch);
  await page.locator(".settings-backdrop").waitFor({ state: "hidden" });
}

// Picks one choice of a segmented row (Music, Quality, Damage numbers, Interface size, Language...).
export async function choose(page, setting, value, { touch } = {}) {
  touch ??= await isTouch(page);
  const button = `.settings-panel [data-setting="${setting}"][data-value="${value}"]`;
  await page.locator(button).first().scrollIntoViewIfNeeded();
  await press(page, button, touch);
  await page.waitForFunction((b) => document.querySelector(b)?.getAttribute("aria-pressed") === "true", button);
}

// The chosen value of a segmented row in the open sheet.
export const chosen = (page, setting) => page.evaluate((s) =>
  document.querySelector(`.settings-panel [data-setting="${s}"][aria-pressed="true"]`)?.dataset.value ?? null, setting);

// Language through the sheet, then closed again (it was a top-bar dropdown before the sheet).
export async function setLanguage(page, language, options = {}) {
  await openSettings(page, "language", options);
  await choose(page, "language", language, options);
  await page.waitForFunction((l) => document.documentElement.lang === l, language);
  await closeSettings(page, options);
}

// Help through Settings → Controls → Help (the match-bar Help button moved there; Pause → Help also works,
// but help opened over the pause menu closes back to it). The sheet closes first, so Help opens over the
// screen the sheet was opened from.
export async function openHelp(page, { touch } = {}) {
  touch ??= await isTouch(page);
  await openSettings(page, "controls", { touch });
  await press(page, '.settings-panel [data-do="help"]', touch);
  await page.locator("#modal:not([hidden]) [data-resume]").waitFor({ state: "visible" });
}

// Pause → Restart / New game, through the confirm card when it shows.
export async function confirmLeave(page, kind, { touch } = {}) {
  touch ??= await isTouch(page);
  const card = page.locator(`#modal [data-confirmed="${kind}"]`);
  if (await card.isVisible().catch(() => false)) await press(page, `#modal [data-confirmed="${kind}"]`, touch);
}
