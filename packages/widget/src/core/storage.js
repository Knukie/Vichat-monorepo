import { DEFAULT_CONSTANTS } from './config.js';
import { normalizeRole } from './roles.js';

const IMAGE_TYPES = new Set(['user-upload', 'assistant-generated', 'external']);

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

function resolveConversationKey(agentId) {
  const safeId = String(agentId || '').trim();
  if (!safeId) return null;
  return `vichat_conversation_${safeId}`;
}

export function loadConversationId(agentId) {
  const key = resolveConversationKey(agentId);
  if (!key) return null;
  const stored = readLocalStorage(key);
  return typeof stored === 'string' && stored ? stored : null;
}

export function saveConversationId(agentId, conversationId) {
  const key = resolveConversationKey(agentId);
  if (!key) return;
  const safeValue = String(conversationId || '').trim();
  if (!safeValue) {
    removeLocalStorage(key);
    return;
  }
  writeLocalStorage(key, safeValue);
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

export function loadSelectedAgentId(config = DEFAULT_CONSTANTS) {
  const raw = readLocalStorage(config.selectedAgentKey);
  return typeof raw === 'string' ? raw : '';
}

export function saveSelectedAgentId(agentId, config = DEFAULT_CONSTANTS) {
  const safeId = String(agentId || '').trim();
  if (!safeId) return;
  writeLocalStorage(config.selectedAgentKey, safeId);
}

function normalizeGuestHistoryEntry(item) {
  if (!item) return null;
  const rawRole =
    typeof item.type === 'string' ? item.type : typeof item.role === 'string' ? item.role : '';
  if (!rawRole || typeof item.text !== 'string') return null;
  const role = normalizeRole(rawRole);
  const entry = { type: role, text: item.text };
  if (Array.isArray(item.images)) {
    const images = item.images
      .filter((image) => image && typeof image === 'object')
      .map((image) => ({
        url: typeof image.url === 'string' ? image.url : undefined,
        dataUrl: typeof image.dataUrl === 'string' ? image.dataUrl : undefined,
        type:
          typeof image.type === 'string' && IMAGE_TYPES.has(image.type)
            ? image.type
            : image?.type && String(image.type).startsWith('image/')
              ? 'user-upload'
              : undefined,
        name: typeof image.name === 'string' ? image.name : undefined,
        size: Number.isFinite(image.size) ? image.size : undefined
      }))
      .map((image) => ({
        ...image,
        type: image.type || ((image.url || image.dataUrl) && 'user-upload') || undefined
      }))
      .filter((image) => image.url || image.dataUrl);
    if (images.length) entry.images = images;
  }
  return entry;
}

export function loadGuestHistory(config = DEFAULT_CONSTANTS, agentId) {
  const raw = readLocalStorage(resolveHistoryKey(config, agentId));
  const arr = safeJsonParse(raw, []);
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeGuestHistoryEntry).filter(Boolean);
}

export function saveGuestHistory(arr, config = DEFAULT_CONSTANTS, agentId) {
  const safeHistory = Array.isArray(arr) ? arr.map(normalizeGuestHistoryEntry).filter(Boolean) : [];
  writeLocalStorage(resolveHistoryKey(config, agentId), JSON.stringify(safeHistory));
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

export function createConversationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return generateId('valk-conversation');
}
