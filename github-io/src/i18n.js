import vietnamese from './locales/vi.json' with {type: 'json'};

export const LANGUAGES = Object.freeze({en: 'English', vi: 'Tiếng Việt'});
let language = 'en';
const normalize = text => text.trim().replace(/\s+/g, ' ').toLowerCase();
const messages = new Map(Object.entries(vietnamese.messages).map(([key, value]) => [normalize(key), value]));
const patterns = vietnamese.patterns.map(([source, target]) => [new RegExp(source, 'i'), target]);
const cache = new Map();
export const getLanguage = () => language;
export function setLanguage(value) {
  language = Object.hasOwn(LANGUAGES, value) ? value : 'en';
}

// Presentation only: entity IDs, order names, game rules and shortcuts stay in English.
export function translate(text, locale = language, depth = 0) {
  if (locale !== 'vi' || depth > 6 || !text || !/[a-z]/i.test(text)) return text;
  if (cache.has(text)) return cache.get(text);
  const source = text.trim(), exact = messages.get(normalize(source));
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
    result = pieces.length > 1 ? pieces.map(part => translate(part, locale, depth + 1)).join('') : source;
  }
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
  const excluded = 'script,style,svg,canvas,[translate="no"],[data-no-localize]';
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
    for (const child of node.childNodes) walk(child);
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
    if (language === 'vi') observer.observe(root, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributes});
  }
  function apply(locale) {
    observer.disconnect();
    setLanguage(locale);
    root.ownerDocument.documentElement.lang = language;
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
