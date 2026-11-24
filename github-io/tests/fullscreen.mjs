import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openSettings, closeSettings, setLanguage } from './lib/settings-sheet.mjs';

// Full screen lives in Settings → Display only since the unified settings sheet (2026-11-24): the title-bar,
// match-bar and pause-menu buttons are gone. Where the browser has the API the section has an Enter / Exit
// row; where it has not (iPhone Safari) or the game already runs as a home-screen app, the section says how.
const safari = process.env.TEST_BROWSER === 'webkit';
const browser = await (safari ? webkit : chromium).launch({headless:true, ...(safari ? {} : {
  executablePath:process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args:['--enable-unsafe-swiftshader'],
})});
const url = (process.env.TEST_URL || 'http://127.0.0.1:4191/') + '?test=1';
fs.mkdirSync('test-results', {recursive:true});
const errors = [];
const row = '.settings-panel [data-do="fullscreen"]';
try {
  if (!safari) {
    const page = await browser.newPage({viewport:{width:1280, height:800}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__frontier);
    assert.equal(await page.locator('#fullscreen, #fullscreen-top, #theme-toggle, #language').count(), 0, 'no full screen, theme or language copies outside the sheet');
    // Observe focus inside the API call, before the browser changes display mode.
    await page.evaluate(() => {
      const root = document.documentElement, request = root.requestFullscreen;
      root.requestFullscreen = function (...args) {
        window.__fullscreenRequestFocus = document.activeElement?.dataset.do;
        return request.apply(this, args);
      };
    });
    await openSettings(page, 'display', { touch: false });
    await page.locator(row).click();
    await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
    await page.waitForFunction((b) => document.querySelector(b).getAttribute('aria-pressed') === 'true', row);
    assert.equal(await page.locator(row).innerText(), 'Exit');
    assert.equal(await page.evaluate(() => window.__fullscreenRequestFocus), 'fullscreen', 'the request keeps keyboard focus on the row');
    await closeSettings(page, { touch: false });
    await page.locator('#start').click();
    // In a match: the gear opens the sheet (the match holds while it is open) and Exit leaves full screen.
    await openSettings(page, 'display', { touch: false });
    assert.equal(await page.evaluate(() => window.__frontier.paused), true, 'the sheet holds the match');
    await page.locator(row).click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.waitForFunction((b) => document.querySelector(b).getAttribute('aria-pressed') === 'false', row);
    await closeSettings(page, { touch: false });
    await page.waitForFunction(() => !window.__frontier.paused);
    // The pause menu has no full-screen button any more; Settings and Help sit side by side.
    await page.locator('#pause').click();
    assert.equal(await page.locator('#modal [data-fullscreen]').count(), 0);
    assert.deepEqual(await page.locator('#modal .pause-row button').evaluateAll(bs => bs.map(b => b.hasAttribute('data-settings') ? 'settings' : 'help')), ['settings', 'help']);
    await page.locator('[data-resume]').click();
    await page.close();
    // Phones where the API exists: the match bar is [pause][sound][settings] in one 44 px row without
    // overflow, and the Display row is a 44 px target.
    for (const size of [{width:390,height:844}, {width:844,height:390}, {width:320,height:568}]) {
      const phone = await browser.newPage({viewport:size, isMobile:true, hasTouch:true});
      phone.on('pageerror', error => errors.push(error.message));
      await phone.goto(url);
      await phone.waitForFunction(() => window.__frontier);
      await phone.locator('#start').tap();
      await phone.locator('#briefing-settings').waitFor({state:'visible'});
      const fit = await phone.evaluate(() => {
        const bar = document.querySelector('.topbar');
        const buttons = [...document.querySelectorAll('.top-actions > button')].filter((x) => x.offsetParent);
        const boxes = buttons.map((x) => x.getBoundingClientRect());
        return { ids: buttons.map((b) => b.id), over: bar.scrollWidth - bar.clientWidth, page: document.documentElement.scrollWidth - innerWidth,
          small: boxes.filter((b) => b.width < 40 || b.height < 44).length, right: Math.max(...boxes.map((b) => b.right)), rows: new Set(boxes.map((b) => Math.round(b.top))).size };
      });
      assert.deepEqual(fit.ids, ['pause', 'audio', 'briefing-settings'], `${size.width}x${size.height}: match bar`);
      assert.ok(fit.over <= 0 && fit.page <= 0 && fit.right <= size.width && fit.small === 0 && fit.rows === 1, `${size.width}x${size.height}: match bar ${JSON.stringify(fit)}`);
      await openSettings(phone, 'display', { touch: true });
      const box = await phone.locator(row).boundingBox();
      assert.ok(box && box.height >= 44 && box.width >= 44 && box.x + box.width <= size.width, `${size.width}x${size.height}: Display row ${JSON.stringify(box)}`);
      await phone.close();
    }
  }
  const page = await browser.newPage({viewport:{width:390, height:844}, isMobile:true, hasTouch:true});
  page.on('pageerror', error => errors.push(error.message));
  // Deterministic iPhone-like unsupported API; this is not an iOS system-gesture emulator.
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', {get:() => false, configurable:true});
    Object.defineProperty(document, 'webkitFullscreenEnabled', {get:() => false, configurable:true});
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__frontier);
  for (const size of [{width:390,height:844}, {width:320,height:568}, {width:844,height:390}]) {
    await page.setViewportSize(size);
    await openSettings(page, 'display', { touch: true });
    assert.equal(await page.locator(row).count(), 0, 'no Enter button where the API is missing');
    assert.match(await page.locator('.settings-body').innerText(), /Safari.*Add to Home Screen/);
    await closeSettings(page, { touch: true });
  }
  await setLanguage(page, 'vi', { touch: true });
  await openSettings(page, 'display', { touch: true });
  await page.waitForFunction(() => document.querySelector('.settings-body').textContent.includes('Thêm vào Màn hình chính'));
  await closeSettings(page, { touch: true });
  await page.locator('#start').tap();
  await page.locator('#pause').tap();
  assert.equal(await page.evaluate(() => window.__frontier.paused), true);
  await page.screenshot({path:'test-results/fullscreen-' + (safari ? 'webkit' : 'chromium') + '.png'});
  await page.locator('[data-resume]').tap();
  await page.waitForFunction(() => !window.__frontier.paused);
  assert.deepEqual(errors, []);
  console.log((safari ? 'WebKit' : 'Chrome') + ': fullscreen in Settings → Display, unsupported note, phone match bar, Vietnamese and pause/resume passed.');
} finally { await browser.close(); }
