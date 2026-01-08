import {
  CLIENT_ID_KEY,
  CLIENT_ID_KEY_BASE,
  FLAGS_OVERRIDE_KEY_BASE,
  HISTORY_KEY,
  HISTORY_KEY_BASE,
  MIGRATION_KEY,
  AUTH_TOKEN_KEY_BASE,
  GUEST_METER_KEY_BASE,
  storageKey
} from './config.js';

const LEGACY_HISTORY_KEY = 'valki_history_v20';
const LEGACY_CLIENT_ID_KEY = 'valki_client_id_v20';

const safeGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
};

const isRemoteUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('data:') || value.startsWith('blob:')) return false;
  return /^https?:\/\//i.test(value);
};

const sanitizeAttachments = (attachments) => {
  if (!Array.isArray(attachments)) return [];
  return attachments.reduce((acc, item) => {
    const url = typeof item === 'string'
      ? item
      : item && typeof item === 'object'
        ? item.dataUrl || item.url
        : '';
    if (isRemoteUrl(url)) {
      acc.push({ dataUrl: url });
    }
    return acc;
  }, []);
};

const migrateUnprefixedKeys = () => {
  const baseKeys = [
    HISTORY_KEY_BASE,
    AUTH_TOKEN_KEY_BASE,
    GUEST_METER_KEY_BASE,
    CLIENT_ID_KEY_BASE,
    FLAGS_OVERRIDE_KEY_BASE
  ];
  let migrated = false;
  baseKeys.forEach((baseKey) => {
    const prefixedKey = storageKey(baseKey);
    const existing = safeGet(prefixedKey);
    if (existing !== null) return;
    const legacyValue = safeGet(baseKey);
    if (legacyValue === null) return;
    if (safeSet(prefixedKey, legacyValue)) {
      migrated = true;
    }
  });
  return migrated;
};

const migrateLegacyHistory = () => {
  const raw = safeGet(LEGACY_HISTORY_KEY);
  if (!raw) return false;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return false;
  }
  if (!Array.isArray(parsed)) return false;
  const migrated = parsed.reduce((acc, item) => {
    if (!item || (item.role !== 'user' && item.role !== 'bot')) return acc;
    const text = typeof item.text === 'string'
      ? item.text
      : typeof item.content === 'string'
        ? item.content
        : '';
    if (!text && !item.attachments) return acc;
    const attachments = sanitizeAttachments(item.attachments);
    const entry = { role: item.role };
    if (text) entry.text = text;
    if (attachments.length) entry.attachments = attachments;
    acc.push(entry);
    return acc;
  }, []);
  if (!migrated.length) return false;
  return safeSet(HISTORY_KEY, JSON.stringify(migrated));
};

const migrateLegacyClientId = () => {
  const legacyId = safeGet(LEGACY_CLIENT_ID_KEY);
  if (!legacyId) return false;
  const currentId = safeGet(CLIENT_ID_KEY);
  if (currentId) return false;
  return safeSet(CLIENT_ID_KEY, legacyId);
};

export const runMigrations = () => {
  const already = safeGet(MIGRATION_KEY);
  if (already === '1') return false;
  const unprefixedMigrated = migrateUnprefixedKeys();
  const historyMigrated = migrateLegacyHistory();
  const clientMigrated = migrateLegacyClientId();
  safeSet(MIGRATION_KEY, '1');
  return unprefixedMigrated || historyMigrated || clientMigrated;
};
