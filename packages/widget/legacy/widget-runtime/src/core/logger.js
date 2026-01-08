const MAX_EVENTS = 200;
const buffer = [];
const diagState = {
  open: false,
  mode: 'shadow',
  version: ''
};

const isDebugEnabled = () => typeof window !== 'undefined' && window.__VALKI_DEBUG__ === true;

const looksLikeUrl = (value) => /^https?:\/\//i.test(value);

const sanitizeUrl = (value) => {
  try {
    const url = new URL(value);
    const path = url.pathname || '/';
    const prefix = path.length > 32 ? path.slice(0, 32) : path;
    return `${url.host}${prefix}`;
  } catch (error) {
    return '';
  }
};

const scrubValue = (key, value, depth = 0) => {
  if (depth > 2) return undefined;
  if (value === null || value === undefined) return value;
  const keyLower = String(key || '').toLowerCase();
  if (keyLower.includes('token')) return '[redacted]';
  if (keyLower.includes('message') || keyLower.includes('text')) {
    if (typeof value === 'string') return value.length;
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    if (looksLikeUrl(value)) {
      return sanitizeUrl(value);
    }
    return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(key, item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.keys(value).reduce((acc, itemKey) => {
      acc[itemKey] = scrubValue(itemKey, value[itemKey], depth + 1);
      return acc;
    }, {});
  }
  return value;
};

const scrubMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return {};
  return Object.keys(metadata).reduce((acc, key) => {
    acc[key] = scrubValue(key, metadata[key], 0);
    return acc;
  }, {});
};

export const logEvent = ({ name, category, status, metadata }) => {
  const entry = {
    name: String(name || 'event'),
    timestamp: new Date().toISOString(),
    category: String(category || 'ui'),
    status: String(status || 'ok'),
    metadata: scrubMetadata(metadata)
  };
  buffer.push(entry);
  if (buffer.length > MAX_EVENTS) {
    buffer.splice(0, buffer.length - MAX_EVENTS);
  }
};

export const setDiagState = (partial) => {
  if (!partial || typeof partial !== 'object') return;
  Object.assign(diagState, partial);
};

export const getDiagSnapshot = () => ({
  events: buffer.slice(),
  state: { ...diagState }
});

const exposeDiag = () => {
  if (!isDebugEnabled()) return;
  if (typeof window === 'undefined') return;
  if (typeof window.__VALKI_DIAG__ === 'function') return;
  window.__VALKI_DIAG__ = () => getDiagSnapshot();
};

exposeDiag();

export { isDebugEnabled };
