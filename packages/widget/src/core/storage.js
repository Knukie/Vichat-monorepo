import { DEFAULT_CONSTANTS } from './config.js';

export function cleanText(value) {
  return String(value ?? '').replace(/\u0000/g, '').trim();
}

export function safeJsonParse(raw, fallback) {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function parsePx(value) {
  const num = parseFloat(String(value ?? '').replace('px', ''));
  return Number.isFinite(num) ? num : 0;
}

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* no-op */
  }
}

function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

export function getAuthToken(config = DEFAULT_CONSTANTS) {
  return readLocalStorage(config.authKey) || '';
}

export function setAuthToken(token, config = DEFAULT_CONSTANTS) {
  writeLocalStorage(config.authKey, String(token || ''));
}

export function clearAuthToken(config = DEFAULT_CONSTANTS) {
  removeLocalStorage(config.authKey);
}

function resolveHistoryKey(config, agentId) {
  if (!agentId) return config.historyKey;
  return `${config.historyKey}:${agentId}`;
}

export function loadGuestHistory(config = DEFAULT_CONSTANTS, agentId) {
  const raw = readLocalStorage(resolveHistoryKey(config, agentId));
  const arr = safeJsonParse(raw, []);
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (item) => item && (item.type === 'user' || item.type === 'bot') && typeof item.text === 'string'
  );
}

export function saveGuestHistory(arr, config = DEFAULT_CONSTANTS, agentId) {
  writeLocalStorage(resolveHistoryKey(config, agentId), JSON.stringify(arr || []));
}

export function clearGuestHistory(config = DEFAULT_CONSTANTS, agentId) {
  removeLocalStorage(resolveHistoryKey(config, agentId));
}

export function getGuestMeter(config = DEFAULT_CONSTANTS) {
  const raw = readLocalStorage(config.guestMeterKey);
  const meter = safeJsonParse(raw, null) || { count: 0, roundsShown: 0 };
  meter.count = Number.isFinite(Number(meter.count)) ? Number(meter.count) : 0;
  meter.roundsShown = Number.isFinite(Number(meter.roundsShown)) ? Number(meter.roundsShown) : 0;
  return meter;
}

export function setGuestMeter(meter, config = DEFAULT_CONSTANTS) {
  writeLocalStorage(config.guestMeterKey, JSON.stringify(meter));
}

export function resetGuestMeter(config = DEFAULT_CONSTANTS) {
  removeLocalStorage(config.guestMeterKey);
}

export function shouldShowBubbleBadge(config = DEFAULT_CONSTANTS) {
  const seen = readLocalStorage(config.bubbleSeenKey);
  return seen !== '1';
}

export function markBubbleSeen(config = DEFAULT_CONSTANTS) {
  writeLocalStorage(config.bubbleSeenKey, '1');
}

export function getOrCreateClientId(config = DEFAULT_CONSTANTS) {
  const existing = readLocalStorage(config.clientIdKey);
  if (existing && typeof existing === 'string') return existing;
  const id = generateId('valk-client');
  writeLocalStorage(config.clientIdKey, id);
  return id;
}

export function generateId(prefix = 'id') {
  const p = String(prefix || 'id');
  try {
    const cryptoObj = window.crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const arr = new Uint32Array(2);
      cryptoObj.getRandomValues(arr);
      const hex = Array.from(arr, (n) => n.toString(16).padStart(8, '0')).join('');
      return `${p}-${hex}`;
    }
  } catch {
    /* ignore */
  }
  return `${p}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
