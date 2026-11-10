// Shared harness for the browser suites. Plain Playwright (no test runner), small on purpose:
// launch one browser, open pages at the three standard viewports with JavaScript errors and bad
// responses captured, build `?test` URLs, take screenshots and report pass/fail with timing.
// See docs/TESTING.md ("Writing a suite") for the pattern; browser, hotkeys and language use it.
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  portrait: { width: 390, height: 844, mobile: true },
  landscape: { width: 844, height: 390, mobile: true },
};
// Waits (ms) every suite uses; pass `timeout` explicitly only when a step is slower on purpose.
export const TIMEOUT = { models: 90000, step: 20000 };
export const OUTPUT = "test-results";

export const baseUrl = (fallback = "http://127.0.0.1:4173/") => process.env.TEST_URL || fallback;
// The game URL with the opt-in test hook (window.__frontier); `extra` is more query text, e.g. "firstrun".
export function testUrl(extra = "", fallback) {
  const base = baseUrl(fallback);
  return `${base}${base.includes("?") ? "&" : "?"}test=1${extra ? `&${extra}` : ""}`;
}

export function launchBrowser({ args = [] } = {}) {
  const chrome = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
  return chromium.launch({
    headless: true,
    ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}),
    args: ["--enable-unsafe-swiftshader", ...(process.env.SOFTWARE_RENDER ? ["--use-angle=swiftshader", "--use-gl=angle"] : []), ...args],
  });
}

// A page at a named viewport (or {width, height, mobile}). Touch viewports are phone emulation.
// Errors and failed responses collect in `errors` and `badResponses`; `tap` taps on touch
// viewports and clicks otherwise.
export async function openPage(browser, viewport = "desktop", { deviceScaleFactor, timeout } = {}) {
  const size = typeof viewport === "string" ? VIEWPORTS[viewport] : viewport;
  if (!size) throw new Error(`Unknown viewport ${viewport}`);
  const mobile = !!size.mobile;
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
  });
  if (timeout) page.setDefaultTimeout(timeout);
  const errors = [], badResponses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return {
    page, mobile, errors, badResponses,
    tap: (selector) => page.locator(selector).first()[mobile ? "tap" : "click"](),
    goto: (extra = "", options) => page.goto(testUrl(extra), options),
    // The start screen is ready: every model parsed and Start enabled.
    ready: (timeout = TIMEOUT.models) => page.waitForFunction(() => window.__frontier?.view.models.size === 13 && !document.querySelector("#start").disabled, null, { timeout }),
  };
}

export async function shot(page, name) {
  mkdirSync(OUTPUT, { recursive: true });
  await page.screenshot({ path: `${OUTPUT}/${name}.png` });
}

// Runs one suite: prints PASS/FAIL with the time (CI collects every suite's line in its step
// summary, see pages.yml), closes the browser and sets the exit code.
export async function suite(name, body, { browser } = {}) {
  const started = Date.now();
  let failure = null;
  try {
    await body();
  } catch (error) {
    failure = error;
  } finally {
    await browser?.close();
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const line = `${failure ? "FAIL" : "PASS"} ${name} (${seconds}s)`;
  console.log(line);
  if (failure) {
    console.error(failure);
    process.exitCode = 1;
  }
}
