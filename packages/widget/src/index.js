import { templateHtml } from './core/ui/template.js';
import { buildConfig } from './core/config.js';
import {
  cleanText,
  clearAuthToken,
  clearGuestHistory,
  getAuthToken,
  getOrCreateClientId,
  loadConversationId,
  loadSelectedAgentId,
  markBubbleSeen,
  saveConversationId,
  saveGuestHistory,
  saveSelectedAgentId,
  setAuthToken,
  shouldShowBubbleBadge
} from './core/storage.js';
import { findAgentById, getDefaultAgents, normalizeAgents } from './core/agents.js';
import { createAttachmentController } from './core/attachments.js';
import { createGuestMeter } from './core/guestMeter.js';
import { createAgentHubController } from './core/ui/agentHub.js';
import { createMessageController } from './core/ui/messages.js';
import { createComposerController } from './core/ui/composer.js';
import { createOverlayController, setVisible } from './core/ui/overlay.js';
import { createWidgetHost } from './core/ui/widgetHost.js';
import { createAuthController } from './core/auth.js';
import { fetchMe, importGuestMessages, uploadImages } from './core/api.js';
import { createWsClient } from './core/wsClient.js';
import {
  abortActiveStream,
  clearAnalysisTimer,
  cancelCheckingSourcesPlaceholder,
  clearRenderTimer,
  clearStreamingState,
  ensureBotRow,
  ensureTypingIndicator,
  finalizeStreaming,
  initStreamingState,
  removeTypingRow,
  scheduleCheckingSourcesPlaceholder,
  scheduleStreamFlush,
  shouldIgnoreStreamEvent
} from './core/streaming.js';
import {
  clearChatAll,
  handleClearingChatSocketClose,
  loadLoggedInMessagesToUI,
  loadMessagesForCurrentAgent,
  logout
} from './core/chatActions.js';
import { detectLocale, setLocale, t } from './i18n/index.js';
import { resolveTheme } from './themes/index.js';
import { createAnimatedEllipsis } from './core/ui/animatedEllipsis.js';

/** @typedef {import('@valki/contracts').ImageMeta} ImageMeta */
/** @typedef {import('@valki/contracts').Message} Message */
/** @typedef {import('@valki/contracts').Role} Role */
/** @typedef {import('@valki/contracts').User} User */
/** @typedef {Role} UiRole */
/** @typedef {Pick<Message, 'role'> & { role: UiRole, text: string, images?: ImageMeta[] }} UiMessage */
/** @typedef {Partial<ImageMeta> & { dataUrl?: string }} UiGuestImage */
/** @typedef {{ type: UiRole, text: string, images?: UiGuestImage[] }} UiGuestMessage */
/** @typedef {User & { name?: string | null }} UiUser */
/** @typedef {Partial<ImageMeta> & { name?: string, dataUrl?: string, mime?: string }} UiImagePayload */

const REQUIRED_IDS = [
  'valki-root',
  'valki-bubble',
  'valki-bubble-badge',
  'valki-bubble-ping',
  'valki-overlay',
  'valki-chat-shell',
  'valki-sidebar',
  'valki-agent-hub',
  'valki-agent-title',
  'valki-agent-subtitle',
  'valki-agent-list',
  'valki-agent-empty',
  'valki-agent-close',
  'valki-agent-back',
  'valki-close',
  'valki-header-avatar',
  'valki-title',
  'valki-session-label',
  'valki-loginout-btn',
  'valki-deleteall-btn',
  'valki-messages',
  'valki-messages-inner',
  'valki-scroll-bottom',
  'valki-sources-overlay',
  'valki-sources-label',
  'valki-sources-ellipsis',
  'valki-chat-form',
  'valki-chat-input',
  'valki-chat-send',
  'valki-chat-attach',
  'valki-file-input',
  'valki-attachments',
  'valki-auth-overlay',
  'valki-auth-title',
  'valki-auth-subtitle',
  'valki-auth-note',
  'valki-auth-dismiss',
  'valki-login-discord-btn',
  'valki-login-google-btn',
  'valki-join-discord-btn',
  'valki-confirm-overlay',
  'valki-confirm-no',
  'valki-confirm-yes',
  'valki-logout-overlay',
  'valki-logout-no',
  'valki-logout-yes'
];
function ensureStyle(theme) {
  const styleId = `vichat-theme-${theme.name}`;
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = [theme.css, theme.overrideCss].filter(Boolean).join('\n');
  document.head.appendChild(style);
}

function isDesktopLayout() {
  return !!(window.matchMedia && window.matchMedia('(min-width: 1024px)').matches);
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function mountTemplate(theme, target, hostConfig) {
  const existing = document.getElementById('valki-root');
  if (existing) {
    const existingHost = existing.closest('.widget-host');
    const body = document.body;
    if (body?.dataset?.valkiScrollY) {
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      body.style.touchAction = '';
      delete body.dataset.valkiScrollY;
    }
    document.documentElement.classList.remove('valki-chat-open');
    document.documentElement.classList.remove('vichat-open');
    existing.remove();
    if (existingHost && !existingHost.querySelector('#valki-root')) {
      existingHost.remove();
    }
  }

  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  const root = container.querySelector('#valki-root');
  if (!root) throw new Error('ViChat root not found in template');

  const targetEl = target || document.body || document.documentElement;
  const widgetHost = createWidgetHost({ target: targetEl, config: hostConfig });
  widgetHost.appendChild(root);

  const elements = { 'valki-root': root };
  REQUIRED_IDS.forEach((id) => {
    if (id === 'valki-root') {
      return;
    }
    elements[id] = root.querySelector(`#${id}`);
  });

  const missing = Object.entries(elements)
    .filter(([, value]) => !value)
    .map(([id]) => id);
  if (missing.length) {
    throw new Error(`ViChat mount failed. Missing elements: ${missing.join(', ')}`);
  }

  const vv = window.visualViewport;
  const initialHeight = vv?.height || document.documentElement?.clientHeight || window.innerHeight || 0;
  elements['valki-root'].style.setProperty('--valki-vh', `${initialHeight * 0.01}px`);

  elements['valki-title'].textContent = theme.overlayTitle || theme.title || 'ViChat';
  elements['valki-bubble'].setAttribute('aria-label', theme.bubbleLabel || 'Open chat');
  elements['valki-header-avatar'].src = theme.avatarUrl || elements['valki-header-avatar'].src;

  return { elements, host: widgetHost };
}

function createMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class ViChatWidget {
  constructor(options = {}) {
    this.config = buildConfig(options);
    this.localeOverride = options.locale;
    this.copyOverrides = options.copy || {};
    this.locale = setLocale(this.localeOverride || detectLocale());
    this.updateLocalizedCopy();
    this.theme = resolveTheme(this.config.theme);
    this.token = getAuthToken(this.config);
    this.clientId = getOrCreateClientId(this.config);
    /** @type {UiUser | null} */
    this.me = null;
    this.authHard = false;
    this.isSending = false;
    /** @type {UiGuestMessage[]} */
    this.guestHistory = [];
    this.usesDefaultAgents = false;
    this.agents = normalizeAgents(this.config.agents).map((agent) => ({
      ...agent,
      avatarUrl: agent.avatarUrl || this.config.avatarUrl
    }));
    if (!this.agents.length && this.config.mode === 'agent-hub') {
      this.usesDefaultAgents = true;
      this.agents = normalizeAgents(getDefaultAgents(t)).map((agent) => ({
        ...agent,
        avatarUrl: agent.avatarUrl || this.config.avatarUrl
      }));
    }
    this.currentAgentId = null;
    this.conversationId = '';
    this.view = 'chat';
    this.resolveInitialAgentState();
    this.selectedAgentId = this.currentAgentId;
    this.loadConversationIdForAgent(this.currentAgentId);
    this.elements = null;
    this.attachmentController = null;
    this.messageController = null;
    this.composerController = null;
    this.overlayController = null;
    this.agentHubController = null;
    this.guestMeter = null;
    this.authController = null;
    this.widgetHost = null;
    this._layoutRaf = 0;
    this._layoutNudge = 0;
    this._agentSelectRaf = 0;
    this._agentSelectTimer = 0;
    this._pendingAgentSelect = null;
    this._readyDispatched = false;
    this.isOpen = false;
    this.teardownUi = null;
    this.wsPendingMessage = null;
    this.wsStreaming = null;
    this.wsInFlightByRequestId = new Map();
    this.abortedRequestIds = new Set();
    this.abortedMessageIds = new Set();
    this._isClearingChat = false;
    this._clearChatAbortTimer = 0;
    this.wsClient = createWsClient({
      getUrl: () => this.config.wsUrl,
      getToken: () => this.token,
      onReady: () => this.sendPendingWsMessage(),
      onMessage: (message) => this.handleWsMessage(message),
      onClose: (reason) => this.handleWsClose(reason)
    });
  }

  updateLocalizedCopy() {
    if (!this.copyOverrides?.genericError) {
      this.config.copy.genericError = t('errors.generic');
    }
    if (!this.copyOverrides?.noResponse) {
      this.config.copy.noResponse = t('errors.noResponse');
    }
  }

  loadConversationIdForAgent(agentId) {
    this.conversationId = loadConversationId(agentId) || '';
  }

  setConversationId(nextConversationId) {
    const cleanId = cleanText(nextConversationId || '');
    if (!cleanId) return;
    if (cleanId === this.conversationId) return;
    this.conversationId = cleanId;
    saveConversationId(this.currentAgentId, this.conversationId);
  }

  ensureWebSocket() {
    this.wsClient.connect('ensure');
  }

  connectWebSocket(reason) {
    this.wsClient.connect(reason);
  }

  sendWebSocketAuth() {
    this.wsClient.sendAuth();
  }

  sendPendingWsMessage() {
    this.wsClient.sendPendingMessage(this.wsPendingMessage);
  }

  handleWsClose(reason) {
    if (this.wsPendingMessage) {
      this.wsPendingMessage.sent = false;
    }
    handleClearingChatSocketClose(this);
    console.debug('[ViChat debug] websocket closed', { reason });
  }

  handleWsMessage(message) {
    if (message.type === 'assistant.message.start') {
      void this.handleWsAssistantStart(message);
      return;
    }
    if (message.type === 'assistant.message.delta') {
      void this.handleWsAssistantDelta(message);
      return;
    }
    if (message.type === 'assistant.message.end') {
      void this.handleWsAssistantEnd(message);
      return;
    }
    if (message.type === 'assistant.message.error') {
      void this.handleWsAssistantError(message);
      return;
    }
    if (message.type === 'message') {
      this.handleWsReply(message);
      return;
    }
    if (message.type === 'error') {
      this.handleWsError(message);
    }
  }

  initStreamingState(requestId) {
    return initStreamingState(this, requestId);
  }

  clearStreamingState(requestId) {
    return clearStreamingState(this, requestId);
  }

  shouldIgnoreStreamEvent(requestId, eventType = '') {
    return shouldIgnoreStreamEvent(this, requestId, eventType);
  }

  abortActiveStream(reason = 'new-request') {
    return abortActiveStream(this, reason);
  }

  removeTypingRow(state) {
    return removeTypingRow(state);
  }

  clearAnalysisTimer(state) {
    return clearAnalysisTimer(state);
  }

  cancelCheckingSourcesPlaceholder(state) {
    const result = cancelCheckingSourcesPlaceholder(state);
    this.setSourcesOverlayVisible(false);
    return result;
  }

  ensureTypingIndicator(state) {
    return ensureTypingIndicator(this, state);
  }

  async ensureBotRow(state, initialText) {
    const fallbackText = typeof initialText === 'string' ? initialText : state.text;
    return ensureBotRow(this, state, fallbackText);
  }

  clearRenderTimer(state) {
    return clearRenderTimer(state);
  }

  scheduleStreamFlush(state) {
    return scheduleStreamFlush(this, state);
  }

  scheduleCheckingSourcesPlaceholder(state) {
    return scheduleCheckingSourcesPlaceholder(this, state);
  }

  async finalizeStreaming(state) {
    return finalizeStreaming(this, state);
  }

  resetSendState() {
    this.wsPendingMessage = null;
    this.isSending = false;
    this.setSendingState(false);
    this.attachmentController.clearAttachments();
    this.updateDeleteButtonVisibility();
    this.composerController.clampComposer();
    this.scheduleLayoutMetrics?.();
  }

  handleWsReply(message) {
    if (message?.streamed === true) return;
    const reply = typeof message.reply === 'string' && message.reply.trim() ? message.reply : this.config.copy.noResponse;
    const messageId = cleanText(message.messageId || '');
    if (messageId && this.abortedMessageIds.has(messageId)) {
      this.abortedMessageIds.delete(messageId);
      return;
    }
    if (messageId && this.wsPendingMessage?.messageId && messageId !== this.wsPendingMessage.messageId) {
      return;
    }
    const nextConversationId = cleanText(message.conversationId || '');
    if (nextConversationId) this.setConversationId(nextConversationId);

    const pending = this.wsPendingMessage;
    const pendingRequestId = pending?.requestId || '';
    const pendingState = pendingRequestId ? this.wsInFlightByRequestId.get(pendingRequestId) : null;
    if (pendingState) {
      this.removeTypingRow(pendingState);
      this.clearStreamingState(pendingRequestId);
    }

    this.messageController
      ?.addMessage({ type: 'assistant', text: reply })
      .then(() => this.messageController?.scrollToBottomHard?.())
      .catch(() => {});

    if (!this.isLoggedIn()) {
      this.guestHistory.push({ type: 'assistant', text: reply, images: pending?.guestImages });
      saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
      this.guestMeter.maybePromptLoginAfterSend((opts) => this.openAuthOverlay(opts.hard));
    }

    this.resetSendState();
  }

  handleWsError(message) {
    const code = cleanText(message?.code || '');
    const messageId = cleanText(message?.messageId || '');
    if (messageId && this.wsPendingMessage?.messageId && messageId !== this.wsPendingMessage.messageId) {
      return;
    }

    if (code === 'UNAUTHORIZED') {
      clearAuthToken(this.config);
      this.token = '';
      this.me = null;
      this.wsClient.setAuthenticated(false);
      this.updateSessionLabel();
      this.updateLoginOutButtonLabel();
      this.openAuthOverlay(false);

      if (this.wsPendingMessage && !this.wsPendingMessage.unauthorizedRetry) {
        this.wsPendingMessage.sent = false;
        this.wsPendingMessage.unauthorizedRetry = true;
        this.sendPendingWsMessage();
        return;
      }
      if (!this.wsPendingMessage) return;
    }

    const pending = this.wsPendingMessage;
    const pendingRequestId = pending?.requestId || '';
    const pendingState = pendingRequestId ? this.wsInFlightByRequestId.get(pendingRequestId) : null;
    if (pendingState) {
      this.removeTypingRow(pendingState);
      this.clearStreamingState(pendingRequestId);
    }

    const errorReply = this.config.copy.genericError;
    this.messageController
      ?.addMessage({ type: 'assistant', text: errorReply })
      .catch(() => {});

    if (!this.isLoggedIn()) {
      this.guestHistory.push({ type: 'assistant', text: errorReply });
      saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
    }

    this.resetSendState();
  }

  async handleWsAssistantStart(message) {
    const requestId = cleanText(message?.requestId || '');
    if (this.shouldIgnoreStreamEvent(requestId, 'assistant.message.start')) return;
    const state = this.initStreamingState(requestId);
    if (!state) return;
    state.assistantMessageId = cleanText(message?.messageId || '');
    this.setConversationId(message?.conversationId);
    state.started = true;
    this.ensureTypingIndicator(state);
    this.scheduleCheckingSourcesPlaceholder(state);
  }

  async handleWsAssistantDelta(message) {
    const requestId = cleanText(message?.requestId || '');
    if (this.shouldIgnoreStreamEvent(requestId, 'assistant.message.delta')) return;
    const state = this.initStreamingState(requestId);
    if (!state) return;
    const seq = Number(message?.seq || 0);
    if (!Number.isFinite(seq) || seq <= state.lastSeq) return;
    state.lastSeq = seq;
    const delta = typeof message?.delta === 'string' ? message.delta : '';
    if (!state.started) {
      state.started = true;
      this.ensureTypingIndicator(state);
    }
    this.cancelCheckingSourcesPlaceholder(state);
    state.pendingBuffer += delta;
    this.scheduleStreamFlush(state);
  }

  async handleWsAssistantEnd(message) {
    const requestId = cleanText(message?.requestId || '');
    if (this.shouldIgnoreStreamEvent(requestId, 'assistant.message.end')) return;
    const state = requestId
      ? this.wsInFlightByRequestId.get(requestId)
      : this.wsStreaming;
    if (!state) {
      this.resetSendState();
      return;
    }
    state.ended = true;
    state.finishReason = cleanText(message?.finishReason || '');
    this.cancelCheckingSourcesPlaceholder(state);
    this.scheduleStreamFlush(state);
  }

  async handleWsAssistantError(message) {
    const code = cleanText(message?.code || '');
    const requestId = cleanText(message?.requestId || '');
    const errorMessage = cleanText(message?.message || '') || this.config.copy.genericError;
    if (this.shouldIgnoreStreamEvent(requestId, 'assistant.message.error')) return;

    const state = requestId ? this.wsInFlightByRequestId.get(requestId) : this.wsStreaming;
    if (state) {
      this.cancelCheckingSourcesPlaceholder(state);
    }

    if (code === 'UNAUTHORIZED') {
      this.handleWsError({ code, messageId: this.wsPendingMessage?.messageId || '' });
      this.clearStreamingState(requestId);
      return;
    }
    if (state) {
      this.clearAnalysisTimer(state);
      this.clearRenderTimer(state);
      state.showAnalysis = false;
      this.removeTypingRow(state);
      state.text = errorMessage;
      state.placeholderActive = false;
      state.placeholderText = '';
      await this.ensureBotRow(state);
      state.pendingBuffer = '';
      state.ended = true;
      state.finishReason = 'error';
      if (state.uiRow) {
        await this.messageController?.updateMessageText?.(state.uiRow, errorMessage, {
          streaming: false
        });
      }
      if (!this.isLoggedIn()) {
        this.guestHistory.push({ type: 'assistant', text: errorMessage });
        saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
      }
    } else if (this.wsPendingMessage?.failSend) {
      await this.wsPendingMessage.failSend(errorMessage);
    } else {
      await this.messageController?.addMessage({ type: 'assistant', text: errorMessage });
    }

    this.resetSendState();
    this.clearStreamingState(requestId);
  }

  mount(mountTarget) {
    ensureStyle(this.theme);
    this.teardownUi?.();
    this.teardownUi = null;
    const hostConfig = {
      type: 'chat',
      provider: 'valki-vichat',
      ...this.config.widgetHost,
      mode: this.config.mode
    };
    const { elements, host } = mountTemplate(this.theme, mountTarget, hostConfig);
    this.elements = elements;
    this.widgetHost = host;
    this.applyTranslations();
    this.setWidgetState('closed', { emit: false });
    this.bindUi();
    this.scheduleLayoutNudge('mount');
    void this.boot();
  }

  updateLocale(locale) {
    this.locale = setLocale(locale);
    this.updateLocalizedCopy();
    if (this.usesDefaultAgents) {
      this.agents = normalizeAgents(getDefaultAgents(t)).map((agent) => ({
        ...agent,
        avatarUrl: agent.avatarUrl || this.config.avatarUrl
      }));
    }
    this.applyTranslations();
    this.renderAgentHub();
    this.applyAgentToHeader(findAgentById(this.agents, this.currentAgentId));
    this.updateSessionLabel();
    this.updateLoginOutButtonLabel();
    this.composerController?.applyPlaceholders();
  }

  applyTranslations() {
    const el = this.elements;
    if (!el) return;
    const brand = t('branding.assistantName');
    const bubbleLabel = t('bubble.openChat', { brand });
    const composerLabel = t('composer.ariaLabel', { brand });

    el['valki-bubble'].setAttribute('aria-label', bubbleLabel);
    el['valki-sidebar'].setAttribute('aria-label', t('agentHub.sidebarLabel'));
    el['valki-agent-hub'].setAttribute('aria-label', t('agentHub.ariaLabel'));
    el['valki-agent-title'].textContent = t('agentHub.title');
    el['valki-agent-subtitle'].textContent = t('agentHub.subtitle');
    el['valki-agent-empty'].textContent = t('agentHub.empty');
    el['valki-agent-close'].setAttribute('aria-label', t('buttons.close'));
    el['valki-agent-back'].setAttribute('aria-label', t('buttons.backToAgents'));
    el['valki-close'].setAttribute('aria-label', t('buttons.close'));

    el['valki-loginout-btn'].textContent = t('buttons.login');
    el['valki-loginout-btn'].setAttribute('title', t('buttons.login'));
    el['valki-deleteall-btn'].textContent = t('buttons.delete');
    el['valki-deleteall-btn'].setAttribute('title', t('buttons.deleteAllTitle'));

    el['valki-chat-attach'].setAttribute('aria-label', t('buttons.addAttachment'));
    el['valki-chat-send'].setAttribute('aria-label', t('buttons.send'));
    el['valki-chat-input'].setAttribute('aria-label', composerLabel);
    el['valki-attachments'].setAttribute('aria-label', t('attachments.label'));
    el['valki-sources-label'].textContent = t('streaming.checkingSources');

    const disclaimerText = el['valki-root'].querySelector('.valki-disclaimer > div');
    if (disclaimerText) disclaimerText.textContent = t('disclaimer.text');
    const disclaimerButton = el['valki-root'].querySelector('.valki-disclaimer-button');
    if (disclaimerButton) disclaimerButton.textContent = t('disclaimer.cookie');

    const authModal = el['valki-auth-overlay'].querySelector('.valki-auth-modal');
    if (authModal) authModal.setAttribute('aria-label', t('auth.loginRequiredTitle'));
    el['valki-auth-title'].textContent = t('auth.loginContinueTitle');
    el['valki-auth-subtitle'].textContent = t('auth.subtitleSoft');
    el['valki-auth-note'].textContent = t('auth.guestLimits');
    const discordLabel = el['valki-login-discord-btn']?.lastElementChild;
    if (discordLabel) discordLabel.textContent = t('buttons.continueDiscord');
    const googleLabel = el['valki-login-google-btn']?.lastElementChild;
    if (googleLabel) googleLabel.textContent = t('buttons.continueGoogle');
    el['valki-join-discord-btn'].textContent = t('buttons.joinDiscord');
    el['valki-auth-dismiss'].textContent = t('buttons.notNow');

    const confirmTitle = el['valki-confirm-overlay'].querySelector('#valki-confirm-title');
    if (confirmTitle) confirmTitle.textContent = t('confirmDelete.title');
    const confirmSubtitle = el['valki-confirm-overlay'].querySelector('#valki-confirm-subtitle');
    if (confirmSubtitle) confirmSubtitle.textContent = t('confirmDelete.subtitle');
    el['valki-confirm-no'].textContent = t('buttons.cancel');
    el['valki-confirm-yes'].textContent = t('buttons.confirmDelete');

    const logoutOverlay = el['valki-logout-overlay'];
    const logoutTitle = logoutOverlay.querySelector('#valki-logout-title');
    if (logoutTitle) logoutTitle.textContent = t('logout.title');
    const logoutSubtitle = logoutOverlay.querySelector('#valki-logout-subtitle');
    if (logoutSubtitle) logoutSubtitle.textContent = t('logout.subtitle');
    el['valki-logout-no'].textContent = t('buttons.cancel');
    el['valki-logout-yes'].textContent = t('buttons.logoutConfirm');
  }

  dispatchWidgetEvent(name, detail = {}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  debugLogOverlayState(context) {
    if (typeof window === 'undefined') return;
    const el = this.elements;
    if (!el) return;
    const describe = (node) => {
      if (!node) return null;
      const style = window.getComputedStyle(node);
      return {
        id: node.id || undefined,
        className: node.className || undefined,
        classList: Array.from(node.classList || []),
        ariaHidden: node.getAttribute('aria-hidden'),
        inlineDisplay: node.style.display || '',
        inlinePointerEvents: node.style.pointerEvents || '',
        inlineOpacity: node.style.opacity || '',
        computedDisplay: style.display,
        computedOpacity: style.opacity,
        computedPointerEvents: style.pointerEvents,
        computedZIndex: style.zIndex,
        computedVisibility: style.visibility
      };
    };
    let bubbleHit = null;
    const bubbleRect = el['valki-bubble']?.getBoundingClientRect();
    if (bubbleRect && typeof document.elementFromPoint === 'function') {
      const x = bubbleRect.left + bubbleRect.width / 2;
      const y = bubbleRect.top + bubbleRect.height / 2;
      const hit = document.elementFromPoint(x, y);
      bubbleHit = hit
        ? {
            tagName: hit.tagName,
            id: hit.id || undefined,
            className: hit.className || undefined
          }
        : null;
    }
    console.debug('[ViChat debug] overlay state', {
      context,
      loggedIn: this.isLoggedIn(),
      widgetState: el['valki-root']?.dataset?.state,
      isOpen: this.isOpen,
      authHard: this.authHard,
      htmlClass: document.documentElement.className,
      bubbleHit,
      bubble: describe(el['valki-bubble']),
      overlay: describe(el['valki-overlay']),
      authOverlay: describe(el['valki-auth-overlay']),
      confirmOverlay: describe(el['valki-confirm-overlay']),
      logoutOverlay: describe(el['valki-logout-overlay'])
    });
  }

  ensureOverlayOpen(reason) {
    if (!this.overlayController) return;
    const wasOpen = this.overlayController.isChatOpen();
    if (!wasOpen) this.overlayController.openOverlay();
    console.debug('[ViChat debug] ensure overlay open', { reason, wasOpen });
  }

  handleInvalidToken(reason, { promptLogin = false } = {}) {
    if (!this.token) return;
    clearAuthToken(this.config);
    this.token = '';
    this.me = null;
    this.updateSessionLabel();
    this.updateLoginOutButtonLabel();
    console.warn('[ViChat] auth token invalid', { reason });
    if (promptLogin) {
      this.authHard = false;
      this.openAuthOverlay(false);
    }
  }

  setWidgetState(state, { emit = true } = {}) {
    const root = this.elements?.['valki-root'];
    const host = this.widgetHost;
    if (!root || !host) return;
    if (root.dataset.state === state && this.isOpen === (state === 'open')) return;
    root.dataset.state = state;
    host.dataset.state = state;
    this.isOpen = state === 'open';
    if (!emit) return;
    if (state === 'open') {
      this.dispatchWidgetEvent('vichat:open', { state });
      if (typeof this.config.onOpen === 'function') this.config.onOpen();
    } else {
      this.dispatchWidgetEvent('vichat:close', { state });
      if (typeof this.config.onClose === 'function') this.config.onClose();
    }
  }

  bindUi() {
    const el = this.elements;
    this.teardownUi?.();
    this.teardownUi = null;
    if (!el) return;

    const cleanupFns = [];
    const on = (node, event, handler, options) => {
      if (!node) return;
      node.addEventListener(event, handler, options);
      cleanupFns.push(() => node.removeEventListener(event, handler, options));
    };

    const updateComposerHeight = () => {
      try {
        const rect = el['valki-chat-form'].getBoundingClientRect();
        const h = Math.max(0, Math.round(rect?.height || 0));
        if (h) el['valki-root'].style.setProperty('--composer-h', `${h}px`);
      } catch {
        /* ignore */
      }
    };

    const updateKeyboardInset = () => {
      const root = el['valki-root'];
      if (!root) return;
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty('--keyboard-bottom', '0px');
        return;
      }
      const layoutHeight = Math.max(
        document.documentElement?.clientHeight || 0,
        window.innerHeight || 0
      );
      const vvHeight = vv.height || 0;
      const vvOffsetTop = vv.offsetTop || 0;
      const rawInset = layoutHeight - vvHeight - vvOffsetTop;
      const keyboardResizesViewport = vvHeight > 0 && layoutHeight > 0 && vvHeight < layoutHeight - 1;
      const inset = keyboardResizesViewport ? 0 : Math.max(0, Math.round(rawInset));
      root.style.setProperty('--keyboard-bottom', `${inset}px`);
    };

    const updateViewportLayout = () => {
      updateComposerHeight();
      updateKeyboardInset();
      this.updateValkiVh();
      updateScrollIndicator();
      if (el['valki-overlay']) {
        const isDesktop = isDesktopLayout();
        el['valki-overlay'].dataset.layout = isDesktop ? 'desktop' : 'mobile';
        el['valki-overlay'].dataset.transition = isDesktop ? 'none' : 'slide';
      }
    };

    const scheduleLayoutMetrics = () => {
      if (this._layoutRaf) cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = requestAnimationFrame(() => {
        updateViewportLayout();
      });
    };

    const clampComposer = (options) => this.composerController?.clampComposer(options);
    const scrollButton = el['valki-scroll-bottom'];
    const updateScrollIndicator = (nearBottomOverride) => {
      if (!scrollButton || !this.messageController) return;
      const isNear = typeof nearBottomOverride === 'boolean'
        ? nearBottomOverride
        : this.messageController.isNearBottom?.();
      const shouldShow = !isNear;
      scrollButton.classList.toggle('is-visible', shouldShow);
      scrollButton.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    };

    this.composerController = createComposerController({
      chatInput: el['valki-chat-input'],
      chatForm: el['valki-chat-form'],
      config: this.config,
      updateComposerHeight
    });

    const getInitialFocus = () => {
      if (!isDesktopLayout() && this.view === 'agent-hub') {
        const list = el['valki-agent-list'];
        const active = list?.querySelector('.valki-agent-row.is-active');
        return active || list?.querySelector('.valki-agent-row') || el['valki-agent-close'];
      }
      return el['valki-chat-input'];
    };

    this.overlayController = createOverlayController({
      overlay: el['valki-overlay'],
      dialogEl: el['valki-chat-shell'],
      chatInput: el['valki-chat-input'],
      updateValkiVh: () => this.updateValkiVh(),
      updateComposerHeight,
      updateViewportLayout,
      clampComposer,
      scrollToBottom: (force) => this.messageController?.scrollToBottom(force),
      getInitialFocus,
      onOpen: () => {
        this.setWidgetState('open');
        this.debugLogOverlayState('overlay opened');
      },
      onClose: () => {
        this.setWidgetState('closed');
        this.debugLogOverlayState('overlay closed');
      }
    });

    this.guestMeter = createGuestMeter({
      config: this.config,
      isLoggedIn: () => this.isLoggedIn()
    });

    this.messageController = createMessageController({
      messagesEl: el['valki-messages'],
      messagesInner: el['valki-messages-inner'],
      avatarUrl: this.config.avatarUrl,
      updateDeleteButtonVisibility: () => this.updateDeleteButtonVisibility(),
      onScrollUpdate: (isNearBottom) => updateScrollIndicator(isNearBottom),
      isLoggedIn: () => this.isLoggedIn()
    });

    on(el['valki-messages'], 'scroll', () => updateScrollIndicator(), { passive: true });
    on(scrollButton, 'click', () => {
      this.messageController?.scrollToBottom(true);
      updateScrollIndicator(true);
    });

    this.attachmentController = createAttachmentController({
      attachTray: el['valki-attachments'],
      attachButton: el['valki-chat-attach'],
      fileInput: el['valki-file-input'],
      clampComposer,
      updateComposerHeight,
      config: this.config
    });

    this.authController = createAuthController({
      config: this.config,
      onToken: (token) => this.handleAuthToken(token)
    });
    this.authController.attach();

    this.agentHubController = createAgentHubController({
      hubEl: el['valki-agent-hub'],
      listEl: el['valki-agent-list'],
      emptyEl: el['valki-agent-empty'],
      onSelect: (agentId) => this.handleAgentSelection(agentId)
    });

    this.composerController.applyPlaceholders();
    const onLanguageChange = () => {
      if (this.localeOverride) return;
      this.updateLocale(detectLocale());
    };
    on(window, 'languagechange', onLanguageChange);

    on(el['valki-loginout-btn'], 'click', () => this.openAuthOverlay(false));
    on(el['valki-deleteall-btn'], 'click', () => this.onDeleteAll());
    on(el['valki-confirm-no'], 'click', () => this.closeConfirm());
    on(el['valki-confirm-overlay'], 'click', (e) => {
      if (e.target === el['valki-confirm-overlay']) this.closeConfirm();
    });
    on(el['valki-confirm-yes'], 'click', async () => {
      this.closeConfirm();
      await this.clearChatAll();
      this.updateDeleteButtonVisibility();
    });

    on(el['valki-logout-yes'], 'click', async () => {
      this.closeLogoutPrompt();
      await this.logout();
    });
    on(el['valki-logout-no'], 'click', () => this.closeLogoutPrompt());
    on(el['valki-logout-overlay'], 'click', (e) => {
      if (e.target === el['valki-logout-overlay']) this.closeLogoutPrompt();
    });

    on(el['valki-bubble'], 'click', (e) => this.openFromBubble(e));
    const stopChatShellPropagation = (event) => {
      event.stopPropagation();
    };
    const eventHasTarget = (event, selector) => {
      if (!selector) return false;
      if (event?.target instanceof HTMLElement && event.target.closest(selector)) return true;
      if (typeof event?.composedPath !== 'function') return false;
      return event.composedPath().some((node) => node instanceof HTMLElement && node.matches(selector));
    };
    const focusComposerOnTouch = (event) => {
      if (!el['valki-chat-input'] || el['valki-chat-input'].disabled) return;
      if (event.type !== 'touchstart' && event.pointerType !== 'touch') return;
      if (eventHasTarget(event, 'button, a, input[type="file"], #valki-file-input')) return;
      if (eventHasTarget(event, 'textarea, [contenteditable="true"]')) return;
      if (eventHasTarget(event, '.valki-chat-inner, #valki-chat-input')) return;
      if (document.activeElement === el['valki-chat-input']) return;
      requestAnimationFrame(() => {
        try {
          el['valki-chat-input'].focus({ preventScroll: true });
        } catch {
          el['valki-chat-input'].focus();
        }
      });
    };
    const modal = el['valki-overlay']?.querySelector('.valki-modal');
    const composerContainer =
      el['valki-chat-form']?.querySelector('.valki-chat-composer') || el['valki-chat-form'];
    on(modal, 'pointerdown', stopChatShellPropagation);
    on(modal, 'click', stopChatShellPropagation);
    on(modal, 'touchstart', stopChatShellPropagation, { passive: true });
    on(composerContainer, 'pointerdown', focusComposerOnTouch);
    on(composerContainer, 'touchstart', focusComposerOnTouch, { passive: true });
    on(el['valki-chat-form'], 'submit', (e) => {
      e.preventDefault();
      const q = cleanText(el['valki-chat-input'].value);
      const hasAttachments = this.attachmentController
        .snapshot()
        .some((attachment) => attachment?.dataUrl || attachment?.file);
      if (!q && !hasAttachments) return;
      el['valki-chat-input'].value = '';
      clampComposer({ immediate: true });
      this.ask(q);
    });

    on(el['valki-chat-input'], 'keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el['valki-chat-form'].dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
    on(el['valki-chat-input'], 'input', clampComposer);
    on(el['valki-chat-input'], 'change', clampComposer);
    on(el['valki-chat-input'], 'paste', () => setTimeout(clampComposer, 0));
    on(el['valki-chat-input'], 'focus', () => {
      clampComposer({ immediate: true });
      scheduleLayoutMetrics();
      if (isIOS()) {
        requestAnimationFrame(() => {
          const input = el['valki-chat-input'];
          if (!input) return;
          const len = input.value.length;
          try {
            input.setSelectionRange(len, len);
          } catch {
            /* ignore */
          }
          input.scrollTop = 0;
          clampComposer({ immediate: true });
        });
      }
    });

    on(el['valki-chat-attach'], 'click', () => {
      if (el['valki-chat-input'].disabled || this.isSending) return;
      el['valki-file-input'].click();
    });

    on(el['valki-file-input'], 'change', async () => {
      await this.attachmentController.addFiles(el['valki-file-input'].files);
      el['valki-file-input'].value = '';
      clampComposer();
      scheduleLayoutMetrics();
    });

    on(el['valki-close'], 'click', () => {
      this.debugLogOverlayState('close button click');
      this.overlayController.closeOverlay();
    });
    on(el['valki-agent-close'], 'click', () => {
      this.debugLogOverlayState('agent close button click');
      this.overlayController.closeOverlay();
    });
    on(el['valki-agent-back'], 'click', () => this.showAgentHub());

    const overlayEl = el['valki-overlay'];
    const modalEl = overlayEl?.querySelector('.valki-modal');
    const swipeState = {
      active: false,
      dragging: false,
      startX: 0,
      startY: 0,
      width: 0
    };
    const resetSwipe = () => {
      swipeState.active = false;
      swipeState.dragging = false;
      swipeState.width = 0;
      if (!overlayEl) return;
      overlayEl.removeAttribute('data-swipe');
      overlayEl.style.removeProperty('--valki-modal-shift');
    };
    const getSwipeWidth = () => {
      if (!modalEl) return window.innerWidth || 0;
      return Math.max(1, Math.round(modalEl.getBoundingClientRect().width || 0));
    };
    const shouldHandleSwipe = (event) => {
      if (!overlayEl || !modalEl) return false;
      if (event.pointerType && event.pointerType !== 'touch') return false;
      if (!this.overlayController?.isChatOpen()) return false;
      if (this.view !== 'chat') return false;
      if (isDesktopLayout()) return false;
      if (overlayEl.dataset.layout === 'desktop') return false;
      return true;
    };

    const onSwipeStart = (event) => {
      if (!shouldHandleSwipe(event)) return;
      swipeState.active = true;
      swipeState.dragging = false;
      swipeState.startX = event.clientX || 0;
      swipeState.startY = event.clientY || 0;
      swipeState.width = getSwipeWidth();
    };

    const onSwipeMove = (event) => {
      if (!swipeState.active || !overlayEl) return;
      const dx = (event.clientX || 0) - swipeState.startX;
      const dy = (event.clientY || 0) - swipeState.startY;
      if (!swipeState.dragging) {
        if (dx <= 0) return;
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        swipeState.dragging = true;
        overlayEl.setAttribute('data-swipe', 'true');
      }
      if (!swipeState.dragging) return;
      event.preventDefault();
      const width = swipeState.width || getSwipeWidth();
      const clamped = Math.max(0, Math.min(dx, width));
      overlayEl.style.setProperty('--valki-modal-shift', `${clamped}px`);
    };

    const onSwipeEnd = () => {
      if (!swipeState.active || !overlayEl) {
        resetSwipe();
        return;
      }
      if (!swipeState.dragging) {
        resetSwipe();
        return;
      }
      const width = swipeState.width || getSwipeWidth();
      const current = parseFloat(overlayEl.style.getPropertyValue('--valki-modal-shift')) || 0;
      const shouldOpenHub = current > width * 0.28;
      resetSwipe();
      if (shouldOpenHub) {
        this.showAgentHub();
      } else {
        this.setView('chat');
      }
    };

    on(modalEl, 'pointerdown', onSwipeStart);
    on(window, 'pointermove', onSwipeMove, { passive: false });
    on(window, 'pointerup', onSwipeEnd);
    on(window, 'pointercancel', onSwipeEnd);

    on(document, 'keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (el['valki-logout-overlay'].classList.contains('is-visible')) {
        this.closeLogoutPrompt();
        return;
      }
      if (el['valki-confirm-overlay'].classList.contains('is-visible')) {
        this.closeConfirm();
        return;
      }
      if (el['valki-auth-overlay'].classList.contains('is-visible')) {
        if (!this.authHard) this.closeAuthOverlay();
        return;
      }
      if (this.overlayController.isChatOpen()) this.overlayController.closeOverlay();
    });

    const accountTriggers = [
      el['valki-header-avatar'],
      el['valki-title'],
      el['valki-session-label']
    ];
    accountTriggers.forEach((node) => {
      on(node, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isLoggedIn()) this.openLogoutPrompt();
        else this.openAuthOverlay(false);
      });
    });

    on(el['valki-login-discord-btn'], 'click', () => this.authController.openDiscordLogin());
    on(el['valki-login-google-btn'], 'click', () => this.authController.openGoogleLogin());
    on(el['valki-join-discord-btn'], 'click', () => this.authController.openDiscordInvite());

    on(el['valki-auth-dismiss'], 'click', () => this.closeAuthOverlay());
    on(el['valki-auth-overlay'], 'click', (event) => {
      if (event.target === el['valki-auth-overlay']) this.closeAuthOverlay();
    });

    on(document, 'click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      console.debug('[ViChat debug] document click', {
        tag: target?.tagName,
        id: target?.id,
        className: target?.className,
        dataState: target?.getAttribute?.('data-state')
      });
    });

    on(
      window,
      'resize',
      () => {
        scheduleLayoutMetrics();
        this.messageController.scrollToBottom(false);
      },
      { passive: true }
    );
    on(
      window,
      'orientationchange',
      () => setTimeout(() => {
        scheduleLayoutMetrics();
        this.messageController.scrollToBottom(false);
      }, 60),
      { passive: true }
    );

    if (window.visualViewport) {
      const onViewport = () => {
        updateViewportLayout();
        this.messageController.scrollToBottom(false);
      };
      on(window.visualViewport, 'resize', onViewport);
      on(window.visualViewport, 'scroll', onViewport, { passive: true });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          if (document.activeElement === el['valki-chat-input']) clampComposer();
          scheduleLayoutMetrics();
        })
        .catch(() => {});
    }

    const cleanupEllipsis = createAnimatedEllipsis(el['valki-sources-ellipsis'], {
      interval: 450
    });
    cleanupFns.push(cleanupEllipsis);

    this.scheduleLayoutMetrics = scheduleLayoutMetrics;
    this.updateComposerHeight = updateComposerHeight;
    this.updateViewportLayout = updateViewportLayout;
    this.updateValkiVh = this.updateValkiVh.bind(this);
    this.teardownUi = () => {
      cleanupFns.splice(0).forEach((cleanup) => cleanup());
    };
  }

  resolveInitialAgentState() {
    const startAgent = findAgentById(this.agents, this.config.startAgentId);
    if (startAgent) {
      this.currentAgentId = startAgent.id;
      this.view = 'chat';
      return;
    }

    const storedAgentId = loadSelectedAgentId(this.config);
    const storedAgent = findAgentById(this.agents, storedAgentId);
    if (storedAgent) {
      this.currentAgentId = storedAgent.id;
      this.view = 'chat';
      return;
    }

    if (this.agents.length === 1) {
      this.currentAgentId = this.agents[0].id;
      this.view = 'chat';
      return;
    }

    if (this.agents.length > 1) {
      this.view = 'agent-hub';
      return;
    }

    this.view = 'chat';
  }

  renderAgentHub() {
    this.agentHubController?.renderAgents(this.agents, this.selectedAgentId);
  }

  handleAgentSelection(agentId) {
    const agent = findAgentById(this.agents, agentId);
    if (!agent) return;
    this.selectedAgentId = agent.id;
    this.renderAgentHub();
    if (isDesktopLayout()) {
      void this.selectAgent(agent.id);
      return;
    }
    if (this._agentSelectRaf) cancelAnimationFrame(this._agentSelectRaf);
    if (this._agentSelectTimer) clearTimeout(this._agentSelectTimer);
    this._pendingAgentSelect = agent.id;
    this._agentSelectRaf = requestAnimationFrame(() => {
      this._agentSelectRaf = 0;
      this._agentSelectTimer = window.setTimeout(() => {
        this._agentSelectTimer = 0;
        const pending = this._pendingAgentSelect;
        this._pendingAgentSelect = null;
        if (!pending) return;
        void this.selectAgent(pending);
      }, 100);
    });
  }

  setView(view) {
    const desktop = isDesktopLayout();
    const effectiveView = desktop && view === 'agent-hub' ? 'chat' : view;
    this.view = view;
    if (this.elements?.['valki-overlay']) {
      this.elements['valki-overlay'].dataset.view = effectiveView;
      this.elements['valki-overlay'].dataset.layout = desktop ? 'desktop' : 'mobile';
      this.elements['valki-overlay'].dataset.transition = desktop ? 'none' : 'slide';
    }
    const backBtn = this.elements?.['valki-agent-back'];
    if (backBtn) {
      if (desktop) {
        backBtn.style.display = 'none';
      } else {
        backBtn.style.display = this.agents.length > 1 && view === 'chat' ? 'inline-flex' : 'none';
      }
    }
    if (effectiveView === 'chat') {
      this.scheduleLayoutNudge('view-change');
    }
  }

  applyAgentToHeader(agent) {
    const el = this.elements;
    if (!el) return;
    if (agent) {
      el['valki-title'].textContent = agent.name;
      if (agent.avatarUrl) {
        el['valki-header-avatar'].src = agent.avatarUrl;
      }
      el['valki-header-avatar'].alt = t('avatar.assistantWithName', { name: agent.name });
      this.messageController?.setAgentMeta({ avatarUrl: agent.avatarUrl || this.config.avatarUrl, name: agent.name });
    } else {
      el['valki-title'].textContent = this.theme.overlayTitle || this.theme.title || t('branding.defaultTitle');
      el['valki-header-avatar'].src = this.theme.avatarUrl || this.config.avatarUrl;
      el['valki-header-avatar'].alt = t('avatar.assistantDefault');
      this.messageController?.setAgentMeta({
        avatarUrl: this.config.avatarUrl,
        name: t('branding.assistantName')
      });
    }
  }

  showAgentHub() {
    if (isDesktopLayout()) {
      this.setView('agent-hub');
      this.selectedAgentId = this.currentAgentId;
      this.renderAgentHub();
      if (this.elements?.['valki-sidebar']) this.elements['valki-sidebar'].hidden = false;
      return;
    }
    this.setView('agent-hub');
    this.applyAgentToHeader(null);
    this.selectedAgentId = this.currentAgentId;
    this.renderAgentHub();
    this.messageController?.clearMessagesUI();
  }

  async ensureDesktopAgentSelectedAndChatOpen() {
    if (!isDesktopLayout()) return false;
    if (this.elements?.['valki-sidebar']) this.elements['valki-sidebar'].hidden = false;
    if (!this.agents.length) {
      this.setView('chat');
      return false;
    }
    if ((!this.currentAgentId || this.view === 'agent-hub') && this.agents.length) {
      const firstId = this.currentAgentId || this.agents[0].id;
      await this.selectAgent(firstId);
      return true;
    }
    this.setView('chat');
    this.selectedAgentId = this.currentAgentId;
    this.renderAgentHub();
    return false;
  }

  async selectAgent(agentId) {
    const agent = findAgentById(this.agents, agentId);
    if (!agent) return;
    this.currentAgentId = agent.id;
    this.selectedAgentId = agent.id;
    this.loadConversationIdForAgent(agent.id);
    saveSelectedAgentId(agent.id, this.config);
    this.setView('chat');
    this.applyAgentToHeader(agent);
    this.renderAgentHub();
    await this.loadMessagesForCurrentAgent({ forceOpen: true });
  }

  updateValkiVh() {
    try {
      const vv = window.visualViewport;
      const height = vv
        ? Math.max(vv.height + vv.offsetTop, vv.height)
        : document.documentElement?.clientHeight || window.innerHeight;
      this.elements['valki-root'].style.setProperty('--valki-vh', `${height * 0.01}px`);
    } catch {
      /* ignore */
    }
  }

  scheduleLayoutNudge(reason) {
    if (!this.elements) return;
    if (this._layoutNudge) cancelAnimationFrame(this._layoutNudge);
    const host = this.widgetHost;
    if (host) {
      host.dataset.widgetState = 'mounting';
      host.dataset.widgetNudge = reason;
    }
    this._layoutNudge = requestAnimationFrame(() => {
      if (typeof this.updateViewportLayout === 'function') {
        // Force a re-measure after view switches (agent hub -> chat) to avoid
        // first-render composer misalignment when the widget toggles visibility.
        this.updateViewportLayout();
      }
      this.composerController?.clampComposer();
      if (host) {
        void host.offsetHeight;
        host.dataset.widgetState = 'ready';
      }
    });
  }

  isLoggedIn() {
    return !!this.token;
  }

  updateSessionLabel() {
    const sessionLabel = this.elements['valki-session-label'];
    const displayName = this.me?.displayName;
    if (displayName) {
      sessionLabel.textContent = `${displayName} 🟢`;
      this.messageController?.setUserLabel(displayName);
      return;
    }
    if (this.isLoggedIn()) {
      sessionLabel.textContent = t('labels.sessionYou');
      this.messageController?.setUserLabel(t('labels.user'));
      return;
    }
    sessionLabel.textContent = t('labels.sessionGuest');
    this.messageController?.setUserLabel(t('labels.user'));
  }

  updateLoginOutButtonLabel() {
    const btn = this.elements['valki-loginout-btn'];
    if (this.isLoggedIn()) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-flex';
      btn.textContent = t('buttons.login');
      btn.setAttribute('title', t('buttons.login'));
    }
  }

  updateDeleteButtonVisibility() {
    const btn = this.elements['valki-deleteall-btn'];
    btn.style.display = this.messageController.hasAnyRealMessages() ? 'inline-flex' : 'none';
  }

  updateDeleteButtonState(isBusy) {
    if (!this.messageController.hasAnyRealMessages()) return;
    const btn = this.elements['valki-deleteall-btn'];
    btn.disabled = !!isBusy;
    btn.style.opacity = isBusy ? '.55' : '';
    btn.style.pointerEvents = isBusy ? 'none' : '';
  }

  showBubbleBadge(label = '1') {
    this.elements['valki-bubble-badge'].style.display = 'flex';
    this.elements['valki-bubble-badge'].textContent = String(label);
    this.elements['valki-bubble-ping'].style.display = 'block';
  }

  hideBubbleBadge() {
    this.elements['valki-bubble-badge'].style.display = 'none';
    this.elements['valki-bubble-ping'].style.display = 'none';
  }

  openAuthOverlay(hard) {
    this.authHard = !!hard;
    const el = this.elements;
    el['valki-auth-title'].textContent = this.authHard
      ? t('auth.loginRequiredTitle')
      : t('auth.loginContinueTitle');
    el['valki-auth-subtitle'].textContent = this.authHard
      ? t('auth.subtitleHard')
      : t('auth.subtitleSoft');
    el['valki-auth-note'].textContent = this.authHard ? t('auth.noteHard') : t('auth.noteSoft');
    el['valki-auth-dismiss'].style.display = this.authHard ? 'none' : 'inline-block';
    setVisible(el['valki-auth-overlay'], true);
    this.debugLogOverlayState('auth overlay opened');

    if (this.authHard) {
      el['valki-chat-input'].disabled = true;
      el['valki-chat-send'].disabled = true;
      this.attachmentController.setDisabled(true, true);
      this.updateDeleteButtonState(true);
    }
  }

  closeAuthOverlay(force = false) {
    if (this.authHard && !force) return;
    setVisible(this.elements['valki-auth-overlay'], false);
    this.debugLogOverlayState('auth overlay closed');
  }

  openConfirm() {
    setVisible(this.elements['valki-confirm-overlay'], true);
    const cancelButton = this.elements['valki-confirm-no'];
    if (cancelButton) {
      requestAnimationFrame(() => {
        try {
          cancelButton.focus({ preventScroll: true });
        } catch {
          cancelButton.focus();
        }
      });
    }
  }

  closeConfirm() {
    setVisible(this.elements['valki-confirm-overlay'], false);
    this.debugLogOverlayState('confirm overlay closed');
  }

  openLogoutPrompt() {
    setVisible(this.elements['valki-logout-overlay'], true);
  }

  closeLogoutPrompt() {
    setVisible(this.elements['valki-logout-overlay'], false);
    this.debugLogOverlayState('logout overlay closed');
  }

  async handleAuthToken(token) {
    this.token = token;
    setAuthToken(token, this.config);
    this.ensureWebSocket();
    this.sendWebSocketAuth();
    const meResult = await this.loadMe();
    if (meResult && (meResult.status === 401 || meResult.status === 403)) {
      this.handleInvalidToken('fetchMe', { promptLogin: true });
      return;
    }
    this.updateSessionLabel();
    this.updateLoginOutButtonLabel();
    this.guestMeter.reset();

    this.elements['valki-chat-input'].disabled = false;
    this.elements['valki-chat-send'].disabled = false;
    this.attachmentController.setDisabled(false, false);
    this.updateDeleteButtonState(false);
    this.authHard = false;
    this.closeAuthOverlay(true);

    await importGuestMessages({
      token,
      guestHistory: this.guestHistory,
      config: this.config,
      agentId: this.currentAgentId
    });
    // TODO: Guest image attachments are saved client-side but not yet imported server-side.
    this.guestHistory = [];
    clearGuestHistory(this.config, this.currentAgentId);
    await this.loadLoggedInMessagesToUI({ forceOpen: true });
  }

  async loadMe() {
    const result = await fetchMe({ token: this.token, config: this.config });
    this.me = result.user || null;
    return result;
  }

  async loadLoggedInMessagesToUI({ forceOpen = false } = {}) {
    return loadLoggedInMessagesToUI(this, { forceOpen });
  }

  async loadMessagesForCurrentAgent({ forceOpen = false } = {}) {
    return loadMessagesForCurrentAgent(this, { forceOpen });
  }

  async clearChatAll() {
    return clearChatAll(this);
  }

  async logout() {
    return logout(this);
  }

  async renderGuestHistoryToUI() {
    this.messageController.clearMessagesUI();
    for (const m of this.guestHistory) {
      await this.messageController.addMessage({ type: m.type, text: m.text, images: m.images });
    }
    this.messageController.scrollToBottom(true);
    this.updateDeleteButtonVisibility();
    this.scheduleLayoutMetrics?.();
  }

  setSourcesOverlayVisible(isVisible) {
    const overlay = this.elements?.['valki-sources-overlay'];
    if (!overlay) return;
    // Keep the overlay out of layout when hidden to avoid the mobile "stripe" regression.
    if (isVisible) {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-visible');
    } else {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.hidden = true;
    }
  }

  setSendingState(isBusy) {
    const el = this.elements;
    el['valki-chat-send'].disabled = isBusy || !!el['valki-chat-input'].disabled;
    this.attachmentController.setDisabled(isBusy, el['valki-chat-input'].disabled);
    this.updateDeleteButtonState(isBusy);
  }

  async ask(text) {
    const q = cleanText(text);
    if (this.isSending) {
      if (!this.abortActiveStream('new-request')) return;
    }
    /** @type {UiImagePayload[]} */
    const imagesSnapshot = this.attachmentController
      .snapshot()
      .filter((x) => x.dataUrl || x.file);
    if (!q && imagesSnapshot.length === 0) return;
    if (this.guestMeter.guestHardBlocked()) {
      this.openAuthOverlay(true);
      return;
    }

    this.isSending = true;
    this.setSendingState(true);

    const guestImages = imagesSnapshot.length
      ? imagesSnapshot.map(({ file, ...rest }) => ({ ...rest }))
      : undefined;

    await this.messageController.addMessage({ type: 'customer', text: q, images: imagesSnapshot });

    if (!this.isLoggedIn()) {
      this.guestHistory.push({ type: 'customer', text: q, images: guestImages });
      saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
      this.guestMeter.bumpGuestCount();
    }

    const payloadImages = imagesSnapshot;

    let requestId = '';
    const failSend = async (message) => {
      const resolvedMessage = message || this.config.copy.genericError;
      await this.messageController.addMessage({ type: 'assistant', text: resolvedMessage });
      if (!this.isLoggedIn()) {
        this.guestHistory.push({ type: 'assistant', text: resolvedMessage });
        saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
      }
      this.resetSendState();
      if (requestId) {
        this.clearStreamingState(requestId);
      }
    };

    const uploadResult = await uploadImages({
      images: payloadImages,
      token: this.token,
      config: this.config
    });

    if (!uploadResult.ok) {
      await failSend(uploadResult.message || this.config.copy.genericError);
      return;
    }

    const messageId = createMessageId();
    requestId = createMessageId();
    const payload = {
      v: 1,
      type: 'message',
      messageId,
      requestId,
      clientId: this.clientId,
      conversationId: this.conversationId || undefined,
      agentId: this.currentAgentId || undefined,
      locale: this.locale,
      message: q || '',
      images: uploadResult.images || []
    };

    const state = this.initStreamingState(requestId);
    if (state) {
      this.ensureTypingIndicator(state);
    }
    this.wsPendingMessage = {
      messageId,
      requestId,
      payload,
      typingRow: state?.typingRow || null,
      guestImages,
      failSend,
      sent: false,
      unauthorizedRetry: false
    };

    this.ensureWebSocket();
    this.sendPendingWsMessage();
  }

  async openFromBubble(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.debugLogOverlayState('bubble open click');
    this.ensureOverlayOpen('bubble click');
    markBubbleSeen(this.config);
    this.hideBubbleBadge();
    this.setView(this.view);

    const handled = await this.ensureDesktopAgentSelectedAndChatOpen();
    if (handled) return;

    if (this.view === 'agent-hub') {
      this.selectedAgentId = this.currentAgentId;
      this.renderAgentHub();
      return;
    }
    await this.loadMessagesForCurrentAgent({ forceOpen: false });
  }

  onDeleteAll() {
    if (!this.messageController.hasAnyRealMessages() || this.isSending) return;
    if (this.elements['valki-auth-overlay'].classList.contains('is-visible')) return;
    this.openConfirm();
  }

  async boot() {
    let meResult = null;
    try {
      meResult = await this.loadMe();
    } catch {
      meResult = null;
    }
    if (meResult && (meResult.status === 401 || meResult.status === 403)) {
      this.handleInvalidToken('fetchMe', { promptLogin: false });
    }
    this.updateSessionLabel();
    this.updateLoginOutButtonLabel();
    this.attachmentController.setDisabled(false);

    if (shouldShowBubbleBadge(this.config)) this.showBubbleBadge('1');

    this.resolveInitialAgentState();
    this.loadConversationIdForAgent(this.currentAgentId);
    this.setView(this.view);
    this.selectedAgentId = this.currentAgentId;
    this.renderAgentHub();
    this.applyAgentToHeader(findAgentById(this.agents, this.currentAgentId));

    if (this.view === 'chat') {
      await this.loadMessagesForCurrentAgent({ forceOpen: false });
    } else {
      this.messageController.clearMessagesUI();
    }

    this.updateDeleteButtonVisibility();
    this.scheduleLayoutMetrics?.();
    this.composerController.clampComposer();
    this.scheduleLayoutMetrics?.();
    if (!this._readyDispatched) {
      this._readyDispatched = true;
      this.dispatchWidgetEvent('vichat:ready', { state: 'ready' });
    }
  }
}

function resolveMountTarget(options = {}) {
  if (options && options.target instanceof HTMLElement) return options.target;
  if (typeof options.target === 'string') {
    const el = document.querySelector(options.target);
    if (el) return el;
  }
  return document.body || document.documentElement;
}

export function mount(options = {}) {
  const widget = new ViChatWidget(options);
  const target = resolveMountTarget(options);
  widget.mount(target);
  if (typeof window !== 'undefined' && window.__VICHAT_TEST_HOOKS__ === true) {
    window.__VICHAT_WIDGET__ = widget;
  }
  return widget;
}

if (typeof window !== 'undefined') {
  window.ViChat = window.ViChat || {};
  window.ViChat.mount = mount;
}
