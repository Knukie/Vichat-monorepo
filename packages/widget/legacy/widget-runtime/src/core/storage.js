import { AUTH_TOKEN_KEY, HISTORY_KEY, GUEST_METER_KEY, CLIENT_ID_KEY } from './config.js';

const safeGet = (key) => {
  try {
    return localStorage.getItem(key) || '';
  } catch (error) {
    return '';
  }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Ignore.
  }
};

const safeRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore.
  }
};

export const getToken = () => safeGet(AUTH_TOKEN_KEY) || '';

export const setToken = (token) => {
  safeSet(AUTH_TOKEN_KEY, String(token || ''));
};

export const clearToken = () => {
  safeRemove(AUTH_TOKEN_KEY);
};

export const readHistory = () => {
  try {
    const raw = safeGet(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.reduce((acc, item) => {
      if (!item || (item.role !== 'user' && item.role !== 'bot')) return acc;
      const text = typeof item.text === 'string' ? item.text : typeof item.content === 'string' ? item.content : '';
      if (typeof text === 'string') {
        acc.push({ role: item.role, text });
      }
      return acc;
    }, []);
  } catch (error) {
    return [];
  }
};

export const writeHistory = (messages) => {
  try {
    const data = messages.map((item) => ({ role: item.role, text: item.text || '' }));
    safeSet(HISTORY_KEY, JSON.stringify(data));
  } catch (error) {
    // Ignore.
  }
};

export const clearHistory = () => {
  safeRemove(HISTORY_KEY);
};

export const readGuestHistory = () => readHistory();

export const readGuestMeter = () => {
  let raw = '';
  try {
    raw = safeGet(GUEST_METER_KEY);
  } catch (error) {
    raw = '';
  }
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    parsed = {};
  }
  return {
    count: Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : 0,
    roundsShown: Number.isFinite(Number(parsed.roundsShown)) ? Number(parsed.roundsShown) : 0
  };
};

export const writeGuestMeter = (meter) => {
  safeSet(GUEST_METER_KEY, JSON.stringify(meter));
};

export const clearGuestMeter = () => {
  safeRemove(GUEST_METER_KEY);
};

export const readClientId = () => safeGet(CLIENT_ID_KEY);

export const writeClientId = (clientId) => {
  safeSet(CLIENT_ID_KEY, clientId);
};
