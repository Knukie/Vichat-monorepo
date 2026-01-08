const readScriptConfig = () => {
  if (typeof document === 'undefined') return {};
  const script = document.querySelector('script[src*="vichat-widget.js"], script[src*="valki-talki.js"]');
  if (!script) return {};
  const getAttr = (name) => script.getAttribute(`data-valki-${name}`);
  return {
    baseUrl: getAttr('base-url'),
    embedMode: getAttr('embed-mode'),
    mountSelector: getAttr('mount-selector')
  };
};

const scriptConfig = readScriptConfig();
// Config precedence: data attributes on loader script -> window globals -> defaults.
const readValue = (scriptValue, globalValue, fallback) => {
  if (typeof scriptValue === 'string' && scriptValue.trim()) return scriptValue.trim();
  if (typeof globalValue === 'string' && globalValue.trim()) return globalValue.trim();
  return fallback;
};
export const BASE_URL = readValue(scriptConfig.baseUrl, typeof window !== 'undefined' ? window.__VALKI_BASE_URL__ : '', 'https://auth.valki.wiki');
const embedModeValue = readValue(scriptConfig.embedMode, typeof window !== 'undefined' ? window.__VALKI_EMBED_MODE__ : '', 'shadow');
export const EMBED_MODE = embedModeValue === 'iframe' ? 'iframe' : 'shadow';
export const MOUNT_SELECTOR = readValue(scriptConfig.mountSelector, typeof window !== 'undefined' ? window.__VALKI_MOUNT_SELECTOR__ : '', '');
export const VALKI_WIDGET_VERSION = '__VALKI_VERSION__';
const resolveTenant = (value) => (value === 'valki-tanki' ? 'valki-tanki' : 'valki');
export const TENANT = resolveTenant(typeof window !== 'undefined' ? window.__VICHAT_TENANT__ : '');
export const DISPLAY_NAME = TENANT === 'valki-tanki' ? 'Valki Talki' : 'Valki';
export const STORAGE_PREFIX = `vichat_${TENANT}_`;
export const storageKey = (key) => `${STORAGE_PREFIX}${key}`;
export const HISTORY_KEY_BASE = 'valki_history_vNext';
export const AUTH_TOKEN_KEY_BASE = 'valki_auth_token_v1';
export const GUEST_METER_KEY_BASE = 'valki_guest_meter_v1';
export const CLIENT_ID_KEY_BASE = 'valki_client_id';
export const FLAGS_OVERRIDE_KEY_BASE = 'valki_flags_override_v1';
export const HISTORY_KEY = storageKey(HISTORY_KEY_BASE);
export const AUTH_TOKEN_KEY = storageKey(AUTH_TOKEN_KEY_BASE);
export const GUEST_METER_KEY = storageKey(GUEST_METER_KEY_BASE);
export const CLIENT_ID_KEY = storageKey(CLIENT_ID_KEY_BASE);
export const FLAGS_OVERRIDE_KEY = storageKey(FLAGS_OVERRIDE_KEY_BASE);
export const MIGRATION_KEY = storageKey('migrated_v1');
export const REQUEST_TIMEOUT_MS = 20000;
export const FALLBACK_REPLY = 'Thanks for your message.';
export const GUEST_FREE_ROUND_SIZE = 3;
export const GUEST_MAX_ROUNDS = 2;
export const COOKIE_MODAL_SELECTORS = [
  '[data-termly-root]',
  '.termly-styles-root',
  '#termly-code-snippet-support',
  '[data-cookie-preferences]',
  '[aria-label*="cookie" i]'
];
