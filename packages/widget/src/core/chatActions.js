import {
  clearAuthToken,
  clearGuestHistory,
  createConversationId,
  loadGuestHistory,
  loadConversationId,
  saveConversationId,
  saveGuestHistory
} from './storage.js';
import { clearMessages, fetchMessages } from './api.js';

export function ensureConversation(widget, agentId) {
  if (widget.isLoggedIn()) {
    console.debug('[ViChat debug] ensureConversation: auth session active');
    return widget.conversationId || '';
  }
  const safeAgentId = String(agentId || '').trim();
  if (!safeAgentId) {
    console.debug('[ViChat debug] ensureConversation: missing agentId for guest session');
    return '';
  }
  if (widget.conversationId) {
    console.debug('[ViChat debug] ensureConversation: using existing conversation', {
      conversationId: widget.conversationId
    });
    return widget.conversationId;
  }
  const stored = loadConversationId(safeAgentId);
  if (stored) {
    widget.conversationId = stored;
    console.debug('[ViChat debug] ensureConversation: loaded conversation from storage', {
      conversationId: stored
    });
    return stored;
  }
  const created = createConversationId();
  widget.conversationId = created;
  saveConversationId(safeAgentId, created);
  console.debug('[ViChat debug] ensureConversation: created new guest conversation', {
    conversationId: created
  });
  return created;
}

export async function loadLoggedInMessagesToUI(widget, { forceOpen = false } = {}) {
  if (forceOpen) widget.ensureOverlayOpen('load logged-in messages');
  if (!widget.token) return false;
  const { ok, status, messages } = await fetchMessages({
    token: widget.token,
    config: widget.config,
    agentId: widget.currentAgentId
  });
  if (!ok) {
    if (status === 401 || status === 403) {
      widget.handleInvalidToken('fetchMessages', { promptLogin: true });
      return false;
    }
    if (!widget.messageController.hasAnyRealMessages()) {
      await widget.messageController.addMessage({ type: 'assistant', text: widget.config.copy.genericError });
    }
    console.warn('[ViChat] failed to load messages', { status: status ?? 0 });
    widget.updateDeleteButtonVisibility();
    widget.scheduleLayoutMetrics?.();
    return false;
  }
  widget.messageController.clearMessagesUI();
  for (const m of messages || []) {
    await widget.messageController.addMessage({ type: m.role, text: m.text, images: m.images });
  }
  widget.messageController.scrollToBottom(true);
  widget.updateDeleteButtonVisibility();
  widget.scheduleLayoutMetrics?.();
  return true;
}

export async function loadMessagesForCurrentAgent(widget, { forceOpen = false } = {}) {
  if (forceOpen) widget.ensureOverlayOpen('load messages');
  if (widget.isLoggedIn()) {
    console.debug('[ViChat debug] load messages: logged-in flow');
    const ok = await loadLoggedInMessagesToUI(widget, { forceOpen });
    if (!ok && !widget.isLoggedIn()) {
      widget.guestHistory = loadGuestHistory(widget.config, widget.currentAgentId);
      await widget.renderGuestHistoryToUI();
      if (widget.guestMeter.guestHardBlocked()) widget.openAuthOverlay(true);
    }
    return;
  }
  const conversationId = ensureConversation(widget, widget.currentAgentId);
  if (conversationId) {
    console.debug('[ViChat debug] load messages: guest conversation fetch', { conversationId });
    const { ok, messages } = await fetchMessages({
      token: '',
      config: widget.config,
      agentId: widget.currentAgentId,
      conversationId
    });
    if (ok) {
      widget.messageController.clearMessagesUI();
      for (const m of messages || []) {
        await widget.messageController.addMessage({ type: m.role, text: m.text, images: m.images });
      }
      widget.messageController.scrollToBottom(true);
      widget.updateDeleteButtonVisibility();
      widget.scheduleLayoutMetrics?.();
      return;
    }
    console.warn('[ViChat] failed to load guest messages', { conversationId });
  }
  widget.guestHistory = loadGuestHistory(widget.config, widget.currentAgentId);
  await widget.renderGuestHistoryToUI();
  if (widget.guestMeter.guestHardBlocked()) widget.openAuthOverlay(true);
}

export async function clearChatAll(widget) {
  if (widget.isLoggedIn()) {
    const ok = await clearMessages({ token: widget.token, config: widget.config, agentId: widget.currentAgentId });
    if (ok) {
      await loadLoggedInMessagesToUI(widget);
      widget.scheduleLayoutMetrics?.();
      return;
    }
    widget.messageController.clearMessagesUI();
    widget.scheduleLayoutMetrics?.();
    return;
  }
  widget.abortActiveStream('clear-chat');
  widget.wsPendingMessage = null;
  widget.wsStreaming = null;
  widget.wsInFlightByRequestId.clear();
  widget._isClearingChat = true;
  if (widget._clearChatAbortTimer) {
    clearTimeout(widget._clearChatAbortTimer);
  }
  widget._clearChatAbortTimer = window.setTimeout(() => {
    if (!widget._isClearingChat) return;
    widget.abortedRequestIds.clear();
    widget.abortedMessageIds.clear();
    widget._isClearingChat = false;
    widget._clearChatAbortTimer = 0;
  }, 1000);
  widget.wsClient?.close('clear-chat');

  widget.guestHistory = [];
  saveGuestHistory(widget.guestHistory, widget.config, widget.currentAgentId);
  widget.conversationId = '';
  saveConversationId(widget.currentAgentId, '');
  widget.messageController.clearMessagesUI();
  widget.scheduleLayoutMetrics?.();
}

export function handleClearingChatSocketClose(widget) {
  if (!widget._isClearingChat) return;
  if (widget._clearChatAbortTimer) {
    clearTimeout(widget._clearChatAbortTimer);
    widget._clearChatAbortTimer = 0;
  }
  widget.abortedRequestIds.clear();
  widget.abortedMessageIds.clear();
  widget._isClearingChat = false;
}

export async function logout(widget) {
  clearAuthToken(widget.config);
  widget.token = '';
  widget.me = null;
  widget.updateSessionLabel();
  widget.updateLoginOutButtonLabel();

  widget.elements['valki-chat-input'].disabled = false;
  widget.elements['valki-chat-send'].disabled = false;
  widget.attachmentController.setDisabled(false, false);

  widget.attachmentController.clearAttachments();
  widget.guestHistory = [];
  clearGuestHistory(widget.config, widget.currentAgentId);
  widget.guestMeter.reset();

  widget.messageController.clearMessagesUI();
  await widget.renderGuestHistoryToUI();
  widget.scheduleLayoutMetrics?.();
}
