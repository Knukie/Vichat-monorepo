const STORAGE_KEY = 'valki_conversation_id';

export function loadConversationId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setConversationId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id || ''));
  } catch {
    /* no-op */
  }
}
