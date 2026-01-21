import { translations } from './translations.js';

const DEFAULT_LOCALE = 'en';
let currentLocale = DEFAULT_LOCALE;

function normalizeLocale(locale) {
  if (!locale) return '';
  return String(locale).trim().replace('_', '-').toLowerCase();
}

function getLocaleCandidates(locale) {
  const normalized = normalizeLocale(locale);
  if (!normalized) return [];
  const base = normalized.split('-')[0];
  if (!base) return [];
  if (base === normalized) return [normalized];
  return [normalized, base];
}

function findBestLocale(locales) {
  for (const raw of locales) {
    const candidates = getLocaleCandidates(raw);
    for (const candidate of candidates) {
      if (translations[candidate]) return candidate;
    }
  }
  return DEFAULT_LOCALE;
}

function getValue(dict, key) {
  if (!dict) return undefined;
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict);
}

function interpolate(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) return String(vars[name]);
    return match;
  });
}

export function detectLocale() {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const langs = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || DEFAULT_LOCALE];
  return findBestLocale(langs);
}

export function setLocale(locale) {
  currentLocale = findBestLocale([locale]);
  return currentLocale;
}

export function t(key, vars) {
  const locale = currentLocale || DEFAULT_LOCALE;
  const base = locale.split('-')[0];
  const dicts = [translations[locale], translations[base], translations[DEFAULT_LOCALE]];
  for (const dict of dicts) {
    const value = getValue(dict, key);
    if (typeof value === 'string') return interpolate(value, vars);
  }
  return key;
}
