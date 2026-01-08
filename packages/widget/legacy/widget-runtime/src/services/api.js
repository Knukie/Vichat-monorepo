import { FALLBACK_REPLY, REQUEST_TIMEOUT_MS } from '../core/config.js';

export const logApiError = (status, message) => {
  console.error('[ValkiTalki] api error', { status, message });
};

export const requestReply = async ({ baseUrl, message, token, clientId, timeoutMs = REQUEST_TIMEOUT_MS, onLogError = logApiError, onController }) => {
  const controller = new AbortController();
  if (onController) onController(controller);
  let logged = false;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const response = await fetch(`${baseUrl}/api/valki`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, clientId }),
      signal: controller.signal
    });
    if (!response.ok) {
      const messageText = await response.text().catch(() => response.statusText);
      onLogError(response.status, messageText || response.statusText);
      logged = true;
      const apiError = new Error('api error');
      apiError.code = 'api';
      throw apiError;
    }
    const data = await response.json().catch(() => ({}));
    const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
    return reply || FALLBACK_REPLY;
  } catch (error) {
    if (!logged) {
      const status = error && error.name === 'AbortError' ? 'timeout' : 'network';
      const messageText = error && error.message ? error.message : 'Request failed';
      onLogError(status, messageText);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const loadMessages = async ({ baseUrl, token, onUnauthorized }) => {
  if (!token) return null;
  try {
    const response = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) {
      if (onUnauthorized) onUnauthorized();
      return null;
    }
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const messages = Array.isArray(data) ? data : data && Array.isArray(data.messages) ? data.messages : [];
    return messages.reduce((acc, item) => {
      if (!item) return acc;
      const role = item.role === 'assistant' ? 'bot' : 'user';
      const text = typeof item.message === 'string' ? item.message : typeof item.content === 'string' ? item.content : '';
      if (!text) return acc;
      acc.push({ role, text });
      return acc;
    }, []);
  } catch (error) {
    return null;
  }
};

export const clearServerHistory = async ({ baseUrl, token, onUnauthorized }) => {
  if (!token) return { ok: false, unauthorized: false };
  try {
    const response = await fetch(`${baseUrl}/api/clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) {
      if (onUnauthorized) onUnauthorized();
      return { ok: false, unauthorized: true };
    }
    return { ok: response.ok, unauthorized: false };
  } catch (error) {
    return { ok: false, unauthorized: false };
  }
};

export const importGuestHistory = async ({ baseUrl, token, messages }) => {
  if (!token) return false;
  if (!messages.length) return false;
  try {
    const payload = {
      messages: messages.slice(-80).map((message) => ({
        role: message.role === 'bot' ? 'assistant' : 'user',
        content: String(message.text || '')
      }))
    };
    const response = await fetch(`${baseUrl}/api/import-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};
