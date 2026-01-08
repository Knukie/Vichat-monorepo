/** @typedef {import('@valki/contracts').ImageMeta} ImageMeta */
/** @typedef {import('@valki/contracts').Message} Message */
/** @typedef {import('@valki/contracts').Role} Role */
/** @typedef {import('@valki/contracts').User} User */
/** @typedef {Role | 'user'} UiRole */
/** @typedef {Pick<Message, 'role'> & { role: UiRole, text: string }} UiMessage */
/** @typedef {User & { name?: string | null }} UiUser */
/** @typedef {Partial<ImageMeta> & { name?: string, dataUrl?: string }} UiImagePayload */
/** @typedef {{ ok: boolean, messages: UiMessage[] }} FetchMessagesResult */

/** @returns {Promise<UiUser | null>} */
export async function fetchMe({ token, config }) {
  if (!token) return null;
  try {
    const res = await fetch(config.apiMe, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => null);
    if (data && data.loggedIn && data.user) return data.user;
  } catch {
    /* ignore */
  }
  return null;
}

function withAgentParam(url, agentId) {
  if (!agentId) return url;
  const next = new URL(url, window.location.href);
  next.searchParams.set('agentId', agentId);
  return next.toString();
}

/** @returns {Promise<FetchMessagesResult>} */
export async function fetchMessages({ token, config, agentId }) {
  if (!token) return { ok: false, messages: [] };
  try {
    const res = await fetch(withAgentParam(config.apiMessages, agentId), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { ok: false, messages: [] };
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.messages)) return { ok: true, messages: [] };
    return {
      ok: true,
      messages: data.messages.map((m) => ({
        role: m.role === 'assistant' ? 'bot' : 'user',
        text: String(m.content || '')
      }))
    };
  } catch {
    return { ok: false, messages: [] };
  }
}

export async function clearMessages({ token, config, agentId }) {
  if (!token) return false;
  try {
    const res = await fetch(withAgentParam(config.apiClear, agentId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** @param {{ token: string, guestHistory: Array<{ type: UiRole, text: string }>, config: object, agentId: string }} args */
export async function importGuestMessages({ token, guestHistory, config, agentId }) {
  if (!token || !Array.isArray(guestHistory) || !guestHistory.length) return;
  const payload = {
    agentId,
    messages: guestHistory.slice(-80).map((m) => ({
      role: m.type === 'bot' ? 'assistant' : 'user',
      content: String(m.text || '')
    }))
  };

  try {
    await fetch(config.apiImportGuest, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  } catch {
    /* non-fatal */
  }
}

/** @param {{ message: string, clientId: string, images: UiImagePayload[], token: string, config: object, agentId: string }} args */
export async function askValki({ message, clientId, images, token, config, agentId }) {
  const payload = { message, clientId, images, agentId };
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(config.apiValki, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg = config.copy.genericError;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json && typeof json.error === 'string') {
          errMsg = `ksshh… ${json.error}`;
        }
      }
      return { ok: false, message: errMsg };
    }

    const data = await res.json().catch(() => null);
    const reply =
      data && typeof data.reply === 'string' && data.reply.trim()
        ? String(data.reply)
        : config.copy.noResponse;

    return { ok: true, message: reply };
  } catch {
    return { ok: false, message: config.copy.genericError };
  }
}
