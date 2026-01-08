import { FLAGS_OVERRIDE_KEY } from './config.js';

const FLAG_KEYS = [
  'enableIframeMode',
  'enableMarkdown',
  'enableUploads',
  'enableCmpObserver',
  'enableAuth'
];

const DEFAULT_FLAGS = {
  enableIframeMode: typeof window !== 'undefined' && window.__VALKI_EMBED_MODE__ === 'iframe',
  enableMarkdown: true,
  enableUploads: true,
  enableCmpObserver: true,
  enableAuth: true
};

const toBoolean = (value) => {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return undefined;
};

const mergeDisableFlags = (target, source) => {
  if (!source) return;
  FLAG_KEYS.forEach((key) => {
    if (source[key] === false) {
      target[key] = false;
    }
  });
};

const readFlagsFromObject = (source) => {
  if (!source || typeof source !== 'object') return null;
  return FLAG_KEYS.reduce((acc, key) => {
    const value = toBoolean(source[key]);
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
};

const readFlagsFromDataset = (element) => {
  if (!element) return null;
  const flags = {};
  FLAG_KEYS.forEach((key) => {
    const kebab = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    const attrNames = [
      `data-valki-flag-${kebab}`,
      `data-valki-${kebab}`
    ];
    let value;
    attrNames.some((name) => {
      const attrValue = element.getAttribute(name);
      if (attrValue === null) return false;
      value = attrValue;
      return true;
    });
    const parsed = toBoolean(value);
    if (parsed !== undefined) {
      flags[key] = parsed;
    }
  });
  return Object.keys(flags).length ? flags : null;
};

const findLoaderScript = () => {
  if (document.currentScript && document.currentScript.tagName === 'SCRIPT') {
    return document.currentScript;
  }
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  return scripts.find((script) => {
    const src = script.getAttribute('src') || '';
    return src.includes('vichat-widget.js') || src.includes('valki-talki.js');
  }) || null;
};

const readOverrideFlags = () => {
  try {
    const raw = localStorage.getItem(FLAGS_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return readFlagsFromObject(parsed);
  } catch (error) {
    return null;
  }
};

export const getFeatureFlags = () => {
  const flags = { ...DEFAULT_FLAGS };

  const globalFlags = typeof window !== 'undefined' ? readFlagsFromObject(window.__VALKI_FLAGS__) : null;
  const scriptFlags = typeof document !== 'undefined' ? readFlagsFromDataset(findLoaderScript()) : null;
  const widgetFlags = typeof document !== 'undefined'
    ? readFlagsFromDataset(document.querySelector('valki-talki-widget'))
    : null;
  const overrideFlags = typeof window !== 'undefined' ? readOverrideFlags() : null;

  mergeDisableFlags(flags, globalFlags);
  mergeDisableFlags(flags, scriptFlags);
  mergeDisableFlags(flags, widgetFlags);
  mergeDisableFlags(flags, overrideFlags);

  return flags;
};
