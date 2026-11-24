export const LANGUAGES = Object.freeze({en: 'English', vi: 'Tiếng Việt', ko: '한국어'});
// Every non-English language has the same two lazily loaded catalogs: the UI catalog
// (src/locales/LANG.json) and the campaign story (src/locales/story-LANG.json).
const LOADERS = {
  vi: {main: () => import('./locales/vi.js'), story: () => import('./locales/story-vi.js')},
  ko: {main: () => import('./locales/ko.js'), story: () => import('./locales/story-ko.js')},
};
const NAMES = {vi: 'Vietnamese', ko: 'Korean'};
let language = 'en';
const normalize = text => text.trim().replace(/\s+/g, ' ').toLowerCase();
const catalogs = Object.fromEntries(Object.keys(LOADERS).map(lang => [lang, {messages: new Map(), cased: new Map(), patterns: [], cache: new Map(), locale: null, story: null}]));
// Each catalog is its own chunk: English players never download them. Browsers fetch one when
// that language is first shown (loadLocale); Node (unit tests) loads them all up front so
// translate() stays synchronous everywhere.
function install(lang, catalog) {
  const c = catalogs[lang];
  for (const [key, value] of Object.entries(catalog.messages)) { c.messages.set(normalize(key), value); c.cased.set(key, value); }
  c.patterns = catalog.patterns.map(([source, target]) => [new RegExp(source, 'i'), target]);
  c.cache.clear();
}
export function loadLocale(lang = language === 'en' ? 'vi' : language) {
  const c = catalogs[lang];
  if (!c) return Promise.resolve(false);
  c.locale ??= LOADERS[lang].main().then(module => { install(lang, module.default); return true; });
  c.locale.catch(() => { c.locale = null; });
  return c.locale;
}
if (typeof document === 'undefined') for (const lang of Object.keys(LOADERS)) await loadLocale(lang);

// Dev aid: untranslated English reaching the screen is listed once in the console. Only in
// development builds (never production), or when a page opts in with ?i18nwarn.
const warned = new Set();
const warnEnabled = () => import.meta.env?.DEV === true || (typeof location !== 'undefined' && /[?&]i18nwarn/.test(location.search));
function warnMissing(text, lang) {
  if (warned.has(lang + text) || !/[a-z]{3}/i.test(text) || /^[w.-]+$/.test(text) && !/[A-Z]/.test(text.slice(1)) && !text.includes(' ')) return;
  if (!warnEnabled() || !catalogs[lang]?.locale) return;
  warned.add(lang + text);
  console.warn(`[i18n] no ${NAMES[lang]} entry for: ` + JSON.stringify(text));
}
// The campaign story is a separate catalog per language, fetched the first time that language is
// shown, so the main catalog stays small. Entries of the main catalog win; the translation
// cache is dropped because results may change.
export function addMessages(catalog, lang = 'vi') {
  const c = catalogs[lang];
  for (const [key, value] of Object.entries(catalog?.messages || {})) if (!c.messages.has(normalize(key))) c.messages.set(normalize(key), value);
  c.cache.clear();
}
export function loadStory(lang = language === 'en' ? 'vi' : language) {
  const c = catalogs[lang];
  if (!c) return Promise.resolve(false);
  c.story ??= LOADERS[lang].story().then(module => { addMessages(module.default, lang); return true; });
  // A failed download may be retried on the next language change.
  c.story.catch(() => { c.story = null; });
  return c.story;
}
export const getLanguage = () => language;
export function setLanguage(value) {
  language = Object.hasOwn(LANGUAGES, value) ? value : 'en';
}

// Korean particles depend on the sound before them: a pattern target writes "{1}을(를)" because the
// word filled in is not known yet. Once it is, keep the form that fits the final syllable
// (batchim): 을/를, 이/가, 은/는, 과/와, 으로/로 (ㄹ takes 로). Digits read as Sino-Korean numbers.
const DIGIT_FINAL = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0]; // 영 일 이 삼 사 오 육 칠 팔 구: final consonant index
const PARTICLES = {'을(를)': ['을', '를'], '이(가)': ['이', '가'], '은(는)': ['은', '는'], '와(과)': ['과', '와'], '과(와)': ['과', '와']};
export function koreanParticles(text) {
  if (!text.includes('(')) return text;
  return text.replace(/([가-힣\d])(을\(를\)|이\(가\)|은\(는\)|와\(과\)|과\(와\)|\(으\)로)/g, (_, ch, particle) => {
    const final = /\d/.test(ch) ? DIGIT_FINAL[Number(ch)] : (ch.charCodeAt(0) - 0xAC00) % 28;
    if (particle === '(으)로') return ch + (final && final !== 8 ? '으로' : '로');
    return ch + PARTICLES[particle][final ? 0 : 1];
  });
}

// Presentation only: entity IDs, order names, game rules and shortcuts stay in English.
export function translate(text, locale = language, depth = 0) {
  const c = catalogs[locale];
  if (!c || depth > 6 || !text || !/[a-z]/i.test(text)) return text;
  const {messages, patterns, cache} = c;
  if (cache.has(text)) return cache.get(text);
  // A key written in exactly this case wins over the case-insensitive match: the boss state "OVERDRIVE"
  // ("QUÁ TẢI") and the ability "Overdrive" ("Tăng tốc") are different words in Vietnamese.
  const source = text.trim(), exact = c.cased.get(source.replace(/\s+/g, ' ')) ?? messages.get(normalize(source));
  let result = exact;
  if (exact && source === source.toUpperCase() && /[A-Z]{2}/.test(source)) result = exact.toUpperCase();
  if (result === undefined) {
    for (const [pattern, target] of patterns) {
      const match = source.match(pattern);
      if (!match) continue;
      result = target.replace(/\{(\d+)\}/g, (_, index) => translate(match[Number(index)] || '', locale, depth + 1));
      break;
    }
  }
  if (result === undefined) {
    // Translate complete clauses, never substitute arbitrary words inside prose.
    // Split hierarchically: label/description joints first so whole parts hit the catalog, then ' / ' and sentences.
    let pieces = source.split(/(\n+| · | — )/);
    if (pieces.length < 2) pieces = source.split(/( \/ |(?<=[.!?])\s+(?=[A-Z]))/);
    result = pieces.length > 1 ? pieces.map(part => translate(part, locale, depth + 1)).join('') : (warnMissing(source, locale), source);
  }
  if (locale === 'ko' && depth === 0) result = koreanParticles(result);
  result = text.slice(0, text.indexOf(source)) + result + text.slice(text.indexOf(source) + source.length);
  if (cache.size >= 1024) cache.clear();
  cache.set(text, result);
  return result;
}

// Preserve source strings for reversible language switches without rebuilding controls.
// Observe only changed UI nodes, not the WebGL scene, and never rewrite HTML or values.
export function localizeDOM(root, initialLanguage = 'en') {
  const originals = new WeakMap();
  const attributes = ['title', 'aria-label', 'placeholder'];
  // A canvas has no text to translate, but its label is read by screen readers.
  const excluded = 'script,style,svg,[translate="no"],[data-no-localize]';
  const doc = root.ownerDocument, description = doc.querySelector?.('meta[name="description"]');
  const head = {title: doc.title, description: description?.getAttribute('content')};
  function source(node, key, value) {
    let record = originals.get(node);
    if (!record) originals.set(node, record = new Map());
    const old = record.get(key);
    const original = old && value === old.display ? old.source : value;
    const display = translate(original);
    record.set(key, {source: original, display});
    return display;
  }
  function walk(node) {
    if (node.nodeType === 3) {
      if (!node.parentElement?.closest(excluded)) {
        const next = source(node, 'text', node.data);
        if (node.data !== next) node.data = next;
      }
      return;
    }
    if (node.nodeType !== 1 || node.closest(excluded)) return;
    for (const key of attributes) {
      if (!node.hasAttribute(key)) continue;
      const value = node.getAttribute(key), next = source(node, key, value);
      if (value !== next) node.setAttribute(key, next);
    }
    if (node.localName !== 'canvas') for (const child of node.childNodes) walk(child);
  }
  const observer = new MutationObserver(records => {
    observer.disconnect();
    const pending = new Set();
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(node => pending.add(node));
      else pending.add(record.target);
    }
    for (const node of pending) if (root.contains(node)) walk(node);
    observe();
  });
  function observe() {
    if (language !== 'en') observer.observe(root, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributes});
  }
  function apply(locale) {
    observer.disconnect();
    setLanguage(locale);
    doc.documentElement.lang = language;
    if (head.title) doc.title = translate(head.title);
    if (head.description) description.setAttribute('content', translate(head.description));
    walk(root);
    observe();
  }
  apply(initialLanguage);
  return {
    apply,
    sourceAttribute(node, key) {
      const value = node.getAttribute(key), old = originals.get(node)?.get(key);
      return old && old.display === value ? old.source : value;
    },
    disconnect: () => observer.disconnect(),
  };
}
