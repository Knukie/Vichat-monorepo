export function createWsClient({
  getUrl,
  getToken,
  onReady,
  onMessage,
  onOpen,
  onClose,
  onError,
  onReconnect
}) {
  let ws = null;
  let ready = false;
  let authenticated = false;
  let backoffMs = 500;
  let reconnectTimer = 0;

  const resetBackoff = () => {
    backoffMs = 500;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = 0;
    }
  };

  const scheduleReconnect = (reason) => {
    if (reconnectTimer) return;
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, 8000);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      connect(`reconnect:${reason}`);
      if (typeof onReconnect === 'function') onReconnect(reason);
    }, delay);
  };

  const connect = (reason = 'connect') => {
    if (typeof WebSocket === 'undefined') return;
    const wsUrl = typeof getUrl === 'function' ? getUrl() : '';
    if (!wsUrl) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket(wsUrl);
      ready = false;

      ws.addEventListener('open', () => {
        resetBackoff();
        sendAuth();
        if (typeof onOpen === 'function') onOpen(reason);
      });

      ws.addEventListener('message', (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        let message = null;
        try {
          message = JSON.parse(raw);
        } catch {
          return;
        }

        if (!message || message.v !== 1 || typeof message.type !== 'string') return;
        if (message.type === 'ready') {
          ready = true;
          authenticated = Boolean(message.authenticated);
          if (typeof onReady === 'function') onReady(message);
          return;
        }
        if (message.type === 'pong') return;
        if (typeof onMessage === 'function') onMessage(message);
      });

      ws.addEventListener('close', () => {
        ready = false;
        authenticated = false;
        ws = null;
        if (typeof onClose === 'function') onClose(reason);
        scheduleReconnect(reason);
      });

      ws.addEventListener('error', () => {
        ready = false;
        if (typeof onError === 'function') onError();
      });
    } catch (err) {
      console.warn('[ViChat] WebSocket connect failed', err);
    }
  };

  const close = (reason = 'close') => {
    if (!ws) return;
    try {
      ws.close(1000, reason);
    } catch {
      /* ignore */
    }
  };

  const sendAuth = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const token = typeof getToken === 'function' ? getToken() : '';
    if (!token) {
      authenticated = false;
      return;
    }
    authenticated = false;
    try {
      ws.send(JSON.stringify({ v: 1, type: 'auth', token }));
    } catch {
      /* ignore */
    }
  };

  const sendPendingMessage = (pendingMessage) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !ready) return false;
    const token = typeof getToken === 'function' ? getToken() : '';
    if (token && !authenticated) return false;
    if (!pendingMessage || pendingMessage.sent) return false;
    pendingMessage.sent = true;
    ws.send(JSON.stringify(pendingMessage.payload));
    return true;
  };

  const send = (payload) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  };

  const isReady = () => ready;
  const isAuthenticated = () => authenticated;
  const isOpen = () => !!ws && ws.readyState === WebSocket.OPEN;
  const setAuthenticated = (nextValue) => {
    authenticated = Boolean(nextValue);
  };

  return {
    connect,
    close,
    send,
    sendAuth,
    sendPendingMessage,
    isReady,
    isAuthenticated,
    isOpen,
    setAuthenticated
  };
}
