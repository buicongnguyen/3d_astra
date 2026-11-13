// CI-like machine for the browser suites, loaded with `node --import` (tests/ci-local.mjs does it).
// GitHub's runners have no GPU and slow cores, and the game's real-time clocks (wave countdowns,
// scenes, the match clock) run on while a test is still checking. Those failures never show on a fast
// desktop with a graphics card. This preload makes every suite, including the ones that launch Chrome
// themselves (most do, and so ignored SOFTWARE_RENDER before), run the way CI does:
//   SOFTWARE_RENDER=1  Chrome draws with SwiftShader (CI has no GPU, so it does the same)
//   SLOW_CPU=<rate>    each page's main thread is slowed by that factor (Chrome's own throttle)
// Calibration (2026-11-13, RTX 4080 desktop): SwiftShader alone gives a match 13 fps and suites run
// 3-4x faster than CI; SLOW_CPU=20 gives about 5 fps and layout-f takes 133 s per viewport (CI 110 s).
// Limiting Chrome to 1-4 cores changed nothing measurable, so there is no core setting.
import { chromium } from "playwright";

const rate = Number(process.env.SLOW_CPU || 0);
const software = !!process.env.SOFTWARE_RENDER;
const SOFTWARE_ARGS = ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader"];

async function throttle(page) {
  try {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate });
  } catch {
    // The page closed first: nothing to slow.
  }
}

function slowContext(context) {
  if (context.__ciLike) return context;
  context.__ciLike = true;
  context.on("page", throttle);
  const newPage = context.newPage.bind(context);
  context.newPage = async (...args) => {
    const page = await newPage(...args);
    await throttle(page);
    return page;
  };
  return context;
}

const launch = chromium.launch.bind(chromium);
chromium.launch = async (options = {}, ...rest) => {
  const args = [...(options.args || [])];
  if (software) for (const a of SOFTWARE_ARGS) if (!args.includes(a)) args.push(a);
  const browser = await launch({ ...options, args }, ...rest);
  if (rate > 1) {
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...a) => slowContext(await newContext(...a));
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async (...a) => {
      const page = await newPage(...a);
      slowContext(page.context());
      await throttle(page);
      return page;
    };
  }
  return browser;
};

console.log(`[ci-like] ${[software && "software rendering", rate > 1 && `CPU slowed ${rate}x`].filter(Boolean).join(", ") || "no change"}`);
