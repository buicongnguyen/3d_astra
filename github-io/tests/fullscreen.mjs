import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const safari = process.env.TEST_BROWSER === 'webkit';
const browser = await (safari ? webkit : chromium).launch({headless:true, ...(safari ? {} : {
  executablePath:process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args:['--enable-unsafe-swiftshader'],
})});
const url = (process.env.TEST_URL || 'http://127.0.0.1:4191/') + '?test=1';
fs.mkdirSync('test-results', {recursive:true});
const errors = [];
try {
  if (!safari) {
    const page = await browser.newPage({viewport:{width:1280, height:800}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__frontier);
    // Observe focus inside the API call, before the browser changes display mode.
    await page.evaluate(() => {
      const root = document.documentElement, request = root.requestFullscreen;
      root.requestFullscreen = function (...args) {
        window.__fullscreenRequestFocus = document.activeElement?.id;
        return request.apply(this, args);
      };
    });
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
    await page.waitForFunction(() => document.querySelector('#fullscreen').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.evaluate(() => window.__fullscreenRequestFocus), 'fullscreen', 'pending request preserves keyboard focus');
    await page.locator('#start').click();
    await page.locator('#pause').click();
    assert.equal(await page.locator('#modal [data-fullscreen]').innerText(), 'Exit full screen');
    await page.locator('#modal [data-fullscreen]').click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.locator('#modal [data-fullscreen]').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-settings')), true, 'keyboard navigation remains inside pause menu');
    assert.equal(await page.evaluate(() => window.__frontier.paused), true, 'changing display mode must not resume a paused battle');
    await page.locator('[data-resume]').click();
    await page.waitForFunction(() => !window.__frontier.paused);
    await page.close();
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
  await page.locator('#fullscreen').tap();
  await page.locator('#modal').waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fullscreen', 'Escape closes pre-game fullscreen help and restores focus');
  for (const size of [{width:390,height:844}, {width:320,height:568}, {width:844,height:390}]) {
    await page.setViewportSize(size);
    await page.locator('#fullscreen').tap();
    await page.waitForFunction(() => !document.querySelector('#modal').hidden);
    assert.match(await page.locator('#modal-content').innerText(), /Safari.*Add to Home Screen/);
    const button = page.locator('[data-resume]');
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= size.width && box.y >= 0 && box.y + box.height <= size.height, 'fallback close button fits screen');
    await button.tap();
  }
  await page.locator('#language').selectOption('vi');
  await page.locator('#fullscreen').tap();
  await page.waitForFunction(() => document.querySelector('#modal-content').textContent.includes('Thêm vào Màn hình chính'));
  assert.equal(await page.locator('[data-resume]').innerText(), 'Quay lại');
  await page.locator('[data-resume]').tap();
  await page.locator('#start').tap();
  await page.locator('#pause').tap();
  await page.locator('#modal [data-fullscreen]').tap();
  assert.equal(await page.evaluate(() => window.__frontier.paused), true);
  await page.screenshot({path:'test-results/fullscreen-' + (safari ? 'webkit' : 'chromium') + '.png'});
  await page.locator('[data-resume]').tap();
  await page.waitForFunction(() => !window.__frontier.paused);
  assert.deepEqual(errors, []);
  console.log((safari ? 'WebKit' : 'Chrome') + ': fullscreen controls, unsupported fallback, phone layouts, Vietnamese and pause/resume passed.');
} finally { await browser.close(); }
