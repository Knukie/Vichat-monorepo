import { templateHtml } from './core/ui/template.js';
import { buildConfig } from './core/config.js';
import {
  cleanText,
  clearAuthToken,
  clearGuestHistory,
  getAuthToken,
  getOrCreateClientId,
  loadGuestHistory,
  markBubbleSeen,
  saveGuestHistory,
  setAuthToken,
  shouldShowBubbleBadge
} from './core/storage.js';
import { DEFAULT_AGENTS, findAgentById, normalizeAgents } from './core/agents.js';
import { createAttachmentController } from './core/attachments.js';
import { createGuestMeter } from './core/guestMeter.js';
import { createAgentHubController } from './core/ui/agentHub.js';
import { createMessageController } from './core/ui/messages.js';
import { createComposerController } from './core/ui/composer.js';
import { createOverlayController, setVisible } from './core/ui/overlay.js';
import { createAuthController } from './core/auth.js';
import { askValki, clearMessages, fetchMe, fetchMessages, importGuestMessages } from './core/api.js';
import { resolveTheme } from './themes/index.js';

/** @typedef {import('@valki/contracts').ImageMeta} ImageMeta */
/** @typedef {import('@valki/contracts').Message} Message */
/** @typedef {import('@valki/contracts').Role} Role */
/** @typedef {import('@valki/contracts').User} User */
/** @typedef {Role | 'user'} UiRole */
/** @typedef {Pick<Message, 'role'> & { role: UiRole, text: string }} UiMessage */
/** @typedef {{ type: UiRole, text: string }} UiGuestMessage */
/** @typedef {User & { name?: string | null }} UiUser */
/** @typedef {Partial<ImageMeta> & { name?: string, dataUrl?: string }} UiImagePayload */

const REQUIRED_IDS = [
  'valki-root',
  'valki-bubble',
  'valki-bubble-badge',
  'valki-bubble-ping',
  'valki-overlay',
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

function mountTemplate(theme, target) {
  const existing = document.getElementById('valki-root');
  if (existing) {
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
    existing.remove();
  }

  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  const root = container.querySelector('#valki-root');
  if (!root) throw new Error('ViChat root not found in template');

  const targetEl = target || document.body || document.documentElement;
  targetEl.appendChild(root);

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

  elements['valki-root'].style.setProperty('--valki-vh', `${(window.innerHeight || 0) * 0.01}px`);

  elements['valki-title'].textContent = theme.overlayTitle || theme.title || 'ViChat';
  elements['valki-bubble'].setAttribute('aria-label', theme.bubbleLabel || 'Open chat');
  elements['valki-header-avatar'].src = theme.avatarUrl || elements['valki-header-avatar'].src;

  return elements;
}

class ViChatWidget {
  constructor(options = {}) {
    this.config = buildConfig(options);
    this.theme = resolveTheme(this.config.theme);
    this.token = getAuthToken(this.config);
    this.clientId = getOrCreateClientId(this.config);
    /** @type {UiUser | null} */
    this.me = null;
    this.authHard = false;
    this.isSending = false;
    /** @type {UiGuestMessage[]} */
    this.guestHistory = [];
    this.agents = normalizeAgents(this.config.agents).map((agent) => ({
      ...agent,
      avatarUrl: agent.avatarUrl || this.config.avatarUrl
    }));
    if (!this.agents.length && this.config.mode === 'agent-hub') {
      this.agents = normalizeAgents(DEFAULT_AGENTS).map((agent) => ({
        ...agent,
        avatarUrl: agent.avatarUrl || this.config.avatarUrl
      }));
    }
    this.currentAgentId = null;
    this.view = 'chat';
    this.resolveInitialAgentState();
    this.elements = null;
    this.attachmentController = null;
    this.messageController = null;
    this.composerController = null;
    this.overlayController = null;
    this.agentHubController = null;
    this.guestMeter = null;
    this.authController = null;
    this._layoutRaf = 0;
  }

  mount(mountTarget) {
    ensureStyle(this.theme);
    this.elements = mountTemplate(this.theme, mountTarget);
    this.bindUi();
    void this.boot();
  }

  bindUi() {
    const el = this.elements;

    const updateComposerHeight = () => {
      try {
        const rect = el['valki-chat-form'].getBoundingClientRect();
        const h = Math.max(0, Math.round(rect?.height || 0));
        if (h) el['valki-root'].style.setProperty('--composer-h', `${h}px`);
      } catch {
        /* ignore */
      }
    };

    const scheduleLayoutMetrics = () => {
      if (this._layoutRaf) cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = requestAnimationFrame(() => {
        updateComposerHeight();
        this.updateValkiVh();
      });
    };

    const clampComposer = () => this.composerController?.clampComposer();

    this.composerController = createComposerController({
      chatInput: el['valki-chat-input'],
      chatForm: el['valki-chat-form'],
      config: this.config,
      updateComposerHeight
    });

    this.overlayController = createOverlayController({
      overlay: el['valki-overlay'],
      chatInput: el['valki-chat-input'],
      updateComposerHeight,
      clampComposer,
      scrollToBottom: (force) => this.messageController?.scrollToBottom(force)
    });

    this.guestMeter = createGuestMeter({
      config: this.config,
      isLoggedIn: () => this.isLoggedIn()
    });

    this.messageController = createMessageController({
      messagesEl: el['valki-messages'],
      messagesInner: el['valki-messages-inner'],
      avatarUrl: this.config.avatarUrl,
      updateDeleteButtonVisibility: () => this.updateDeleteButtonVisibility()
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
      onSelect: (agentId) => this.selectAgent(agentId)
    });

    this.composerController.applyPlaceholders();
    window.addEventListener('languagechange', () => this.composerController.applyPlaceholders());

    el['valki-loginout-btn'].addEventListener('click', () => this.openAuthOverlay(false));
    el['valki-deleteall-btn'].addEventListener('click', () => this.onDeleteAll());
    el['valki-confirm-no'].addEventListener('click', () => this.closeConfirm());
    el['valki-confirm-overlay'].addEventListener('click', (e) => {
      if (e.target === el['valki-confirm-overlay']) this.closeConfirm();
    });
    el['valki-confirm-yes'].addEventListener('click', async () => {
      this.closeConfirm();
      await this.clearChatAll();
      this.updateDeleteButtonVisibility();
    });

    el['valki-logout-yes'].addEventListener('click', async () => {
      this.closeLogoutPrompt();
      await this.logout();
    });
    el['valki-logout-no'].addEventListener('click', () => this.closeLogoutPrompt());
    el['valki-logout-overlay'].addEventListener('click', (e) => {
      if (e.target === el['valki-logout-overlay']) this.closeLogoutPrompt();
    });

    el['valki-bubble'].addEventListener('click', (e) => this.openFromBubble(e));
    el['valki-chat-form'].addEventListener('submit', (e) => {
      e.preventDefault();
      const q = cleanText(el['valki-chat-input'].value);
      if (!q) return;
      el['valki-chat-input'].value = '';
      clampComposer();
      this.ask(q);
    });

    el['valki-chat-input'].addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el['valki-chat-form'].dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
    el['valki-chat-input'].addEventListener('input', clampComposer);
    el['valki-chat-input'].addEventListener('paste', () => setTimeout(clampComposer, 0));

    el['valki-chat-attach'].addEventListener('click', () => {
      if (el['valki-chat-input'].disabled || this.isSending) return;
      el['valki-file-input'].click();
    });

    el['valki-file-input'].addEventListener('change', async () => {
      await this.attachmentController.addFiles(el['valki-file-input'].files);
      el['valki-file-input'].value = '';
      clampComposer();
      scheduleLayoutMetrics();
    });

    el['valki-close'].addEventListener('click', () => this.overlayController.closeOverlay());
    el['valki-agent-close'].addEventListener('click', () => this.overlayController.closeOverlay());
    el['valki-agent-back'].addEventListener('click', () => this.showAgentHub());

    document.addEventListener('keydown', (e) => {
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
      node.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isLoggedIn()) this.openLogoutPrompt();
        else this.openAuthOverlay(false);
      });
    });

    el['valki-login-discord-btn'].addEventListener('click', () => this.authController.openDiscordLogin());
    el['valki-login-google-btn'].addEventListener('click', () => this.authController.openGoogleLogin());
    el['valki-join-discord-btn'].addEventListener('click', () => this.authController.openDiscordInvite());

    el['valki-auth-dismiss'].addEventListener('click', () => this.closeAuthOverlay());
    el['valki-auth-overlay'].addEventListener('click', (event) => {
      if (event.target === el['valki-auth-overlay']) this.closeAuthOverlay();
    });

    window.addEventListener(
      'resize',
      () => {
        scheduleLayoutMetrics();
        this.messageController.scrollToBottom(false);
      },
      { passive: true }
    );
    window.addEventListener(
      'orientationchange',
      () => setTimeout(() => {
        scheduleLayoutMetrics();
        this.messageController.scrollToBottom(false);
      }, 60),
      { passive: true }
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        updateComposerHeight();
        this.messageController.scrollToBottom(false);
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          if (document.activeElement === el['valki-chat-input']) clampComposer();
          scheduleLayoutMetrics();
        })
        .catch(() => {});
    }

    this.scheduleLayoutMetrics = scheduleLayoutMetrics;
    this.updateComposerHeight = updateComposerHeight;
    this.updateValkiVh = this.updateValkiVh.bind(this);
  }

  resolveInitialAgentState() {
    const startAgent = findAgentById(this.agents, this.config.startAgentId);
    if (startAgent) {
      this.currentAgentId = startAgent.id;
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

  setView(view) {
    const desktop = isDesktopLayout();
    const effectiveView = desktop && view === 'agent-hub' ? 'chat' : view;
    this.view = view;
    if (this.elements?.['valki-overlay']) {
      this.elements['valki-overlay'].dataset.view = effectiveView;
    }
    const backBtn = this.elements?.['valki-agent-back'];
    if (backBtn) {
      if (desktop) {
        backBtn.style.display = 'none';
      } else {
        backBtn.style.display = this.agents.length > 1 && view === 'chat' ? 'inline-flex' : 'none';
      }
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
      el['valki-header-avatar'].alt = `${agent.name} avatar`;
      this.messageController?.setAgentMeta({ avatarUrl: agent.avatarUrl || this.config.avatarUrl, name: agent.name });
    } else {
      el['valki-title'].textContent = this.theme.overlayTitle || this.theme.title || 'ViChat';
      el['valki-header-avatar'].src = this.theme.avatarUrl || this.config.avatarUrl;
      el['valki-header-avatar'].alt = 'Valki avatar';
      this.messageController?.setAgentMeta({ avatarUrl: this.config.avatarUrl, name: 'Valki' });
    }
  }

  showAgentHub() {
    if (isDesktopLayout()) {
      this.setView('agent-hub');
      this.agentHubController?.renderAgents(this.agents);
      if (this.elements?.['valki-sidebar']) this.elements['valki-sidebar'].hidden = false;
      return;
    }
    this.setView('agent-hub');
    this.applyAgentToHeader(null);
    this.agentHubController?.renderAgents(this.agents);
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
    return false;
  }

  async selectAgent(agentId) {
    const agent = findAgentById(this.agents, agentId);
    if (!agent) return;
    this.currentAgentId = agent.id;
    this.setView('chat');
    this.applyAgentToHeader(agent);
    await this.loadMessagesForCurrentAgent({ forceOpen: true });
  }

  updateValkiVh() {
    try {
      const vv = window.visualViewport;
      const height = vv && vv.height ? vv.height : window.innerHeight;
      this.elements['valki-root'].style.setProperty('--valki-vh', `${height * 0.01}px`);
    } catch {
      /* ignore */
    }
  }

  isLoggedIn() {
    return !!this.token;
  }

  updateSessionLabel() {
    const sessionLabel = this.elements['valki-session-label'];
    if (this.me && this.me.name) {
      sessionLabel.textContent = `${this.me.name} 🟢`;
      return;
    }
    sessionLabel.textContent = this.isLoggedIn() ? 'you 🟢' : 'Guest 🟠';
  }

  updateLoginOutButtonLabel() {
    const btn = this.elements['valki-loginout-btn'];
    if (this.isLoggedIn()) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-flex';
      btn.textContent = 'Login';
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
    el['valki-auth-title'].textContent = this.authHard ? 'Login required' : 'Log in to continue';
    el['valki-auth-subtitle'].textContent = this.authHard
      ? 'You’ve reached the guest limit. Log in to keep chatting.'
      : 'Sign in to keep your chat history and manage messages.';
    el['valki-auth-note'].textContent = this.authHard ? 'Guest limit reached.' : 'Tip: you can continue as guest, but limits apply.';
    el['valki-auth-dismiss'].style.display = this.authHard ? 'none' : 'inline-block';
    setVisible(el['valki-auth-overlay'], true);

    if (this.authHard) {
      el['valki-chat-input'].disabled = true;
      el['valki-chat-send'].disabled = true;
      this.attachmentController.setDisabled(true, true);
      this.updateDeleteButtonState(true);
    }
  }

  closeAuthOverlay(force = false) {
    if (this.authHard && !force) return;
    const el = this.elements['valki-auth-overlay'];
    el.classList.remove('is-visible');
    el.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      el.style.display = 'none';
    }, 180);
  }

  openConfirm() {
    setVisible(this.elements['valki-confirm-overlay'], true);
  }

  closeConfirm() {
    const el = this.elements['valki-confirm-overlay'];
    el.classList.remove('is-visible');
    el.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      el.style.display = 'none';
    }, 180);
  }

  openLogoutPrompt() {
    setVisible(this.elements['valki-logout-overlay'], true);
  }

  closeLogoutPrompt() {
    const el = this.elements['valki-logout-overlay'];
    el.classList.remove('is-visible');
    el.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      el.style.display = 'none';
    }, 180);
  }

  async handleAuthToken(token) {
    this.token = token;
    setAuthToken(token, this.config);
    await this.loadMe();
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
    this.guestHistory = [];
    clearGuestHistory(this.config, this.currentAgentId);
    await this.loadLoggedInMessagesToUI({ forceOpen: true });
  }

  async loadMe() {
    this.me = await fetchMe({ token: this.token, config: this.config });
  }

  async loadLoggedInMessagesToUI({ forceOpen = false } = {}) {
    if (!this.token) return false;
    const { ok, messages } = await fetchMessages({
      token: this.token,
      config: this.config,
      agentId: this.currentAgentId
    });
    if (!ok && !messages.length) return false;
    this.messageController.clearMessagesUI();
    for (const m of messages || []) {
      await this.messageController.addMessage({ type: m.role, text: m.text });
    }
    this.messageController.scrollToBottom(true);
    this.updateDeleteButtonVisibility();
    this.scheduleLayoutMetrics?.();
    if (forceOpen && !this.overlayController.isChatOpen()) this.overlayController.openOverlay();
    return true;
  }

  async loadMessagesForCurrentAgent({ forceOpen = false } = {}) {
    if (this.isLoggedIn()) {
      await this.loadLoggedInMessagesToUI({ forceOpen });
      return;
    }
    this.guestHistory = loadGuestHistory(this.config, this.currentAgentId);
    await this.renderGuestHistoryToUI();
    if (forceOpen && !this.overlayController.isChatOpen()) this.overlayController.openOverlay();
    if (this.guestMeter.guestHardBlocked()) this.openAuthOverlay(true);
  }

  async clearChatAll() {
    if (this.isLoggedIn()) {
      const ok = await clearMessages({ token: this.token, config: this.config, agentId: this.currentAgentId });
      if (ok) {
        await this.loadLoggedInMessagesToUI();
        this.scheduleLayoutMetrics?.();
        return;
      }
      this.messageController.clearMessagesUI();
      this.scheduleLayoutMetrics?.();
      return;
    }
    this.guestHistory = [];
    saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
    this.messageController.clearMessagesUI();
    this.scheduleLayoutMetrics?.();
  }

  async logout() {
    clearAuthToken(this.config);
    this.token = '';
    this.me = null;
    this.updateSessionLabel();
    this.updateLoginOutButtonLabel();

    this.elements['valki-chat-input'].disabled = false;
    this.elements['valki-chat-send'].disabled = false;
    this.attachmentController.setDisabled(false, false);

    this.attachmentController.clearAttachments();
    this.guestHistory = [];
    clearGuestHistory(this.config, this.currentAgentId);
    this.guestMeter.reset();

    this.messageController.clearMessagesUI();
    await this.renderGuestHistoryToUI();
    this.scheduleLayoutMetrics?.();
  }

  async renderGuestHistoryToUI() {
    this.messageController.clearMessagesUI();
    for (const m of this.guestHistory) {
      await this.messageController.addMessage({ type: m.type, text: m.text });
    }
    this.messageController.scrollToBottom(true);
    this.updateDeleteButtonVisibility();
    this.scheduleLayoutMetrics?.();
  }

  setSendingState(isBusy) {
    const el = this.elements;
    el['valki-chat-send'].disabled = isBusy || !!el['valki-chat-input'].disabled;
    this.attachmentController.setDisabled(isBusy, el['valki-chat-input'].disabled);
    this.updateDeleteButtonState(isBusy);
  }

  async ask(text) {
    const q = cleanText(text);
    if (!q || this.isSending) return;
    if (this.guestMeter.guestHardBlocked()) {
      this.openAuthOverlay(true);
      return;
    }

    this.isSending = true;
    this.setSendingState(true);

    /** @type {UiImagePayload[]} */
    const imagesSnapshot = this.attachmentController
      .snapshot()
      .filter((x) => x.dataUrl || x.file);

    await this.messageController.addMessage({ type: 'user', text: q });

    if (!this.isLoggedIn()) {
      this.guestHistory.push({ type: 'user', text: q });
      saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
      this.guestMeter.bumpGuestCount();
    }

    const typingRow = this.messageController.createTypingRow();
    const payloadImages = imagesSnapshot;

    const persistGuestBot = (msg) => {
      if (this.isLoggedIn()) return;
      this.guestHistory.push({ type: 'bot', text: msg });
      saveGuestHistory(this.guestHistory, this.config, this.currentAgentId);
      this.guestMeter.maybePromptLoginAfterSend((opts) => this.openAuthOverlay(opts.hard));
    };

    const removeTyping = () => {
      try {
        typingRow.remove();
      } catch {
        /* ignore */
      }
    };

    try {
      const res = await askValki({
        message: q,
        clientId: this.clientId,
        images: payloadImages,
        token: this.token,
        config: this.config,
        agentId: this.currentAgentId
      });

      removeTyping();
      const reply = res.ok ? res.message : res.message || this.config.copy.genericError;
      await this.messageController.addMessage({ type: 'bot', text: reply });
      persistGuestBot(reply);
      if (res.ok) this.messageController.scrollToBottomHard();
    } catch (err) {
      console.error(err);
      removeTyping();
      await this.messageController.addMessage({ type: 'bot', text: this.config.copy.genericError });
      persistGuestBot(this.config.copy.genericError);
    } finally {
      this.isSending = false;
      this.setSendingState(false);
      this.attachmentController.clearAttachments();
      this.updateDeleteButtonVisibility();
      this.composerController.clampComposer();
      this.scheduleLayoutMetrics?.();
    }
  }

  async openFromBubble(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    markBubbleSeen(this.config);
    this.hideBubbleBadge();
    this.setView(this.view);

    const handled = await this.ensureDesktopAgentSelectedAndChatOpen();
    if (handled) return;

    if (this.view === 'agent-hub') {
      this.overlayController.openOverlay();
      this.agentHubController?.renderAgents(this.agents);
      return;
    }
    await this.loadMessagesForCurrentAgent({ forceOpen: true });
  }

  onDeleteAll() {
    if (!this.messageController.hasAnyRealMessages() || this.isSending) return;
    if (this.elements['valki-auth-overlay'].classList.contains('is-visible')) return;
    this.openConfirm();
  }

  async boot() {
    await this.loadMe();
    this.updateSessionLabel();
    this.updateLoginOutButtonLabel();
    this.attachmentController.setDisabled(false);

    if (shouldShowBubbleBadge(this.config)) this.showBubbleBadge('1');

    this.resolveInitialAgentState();
    this.setView(this.view);
    this.agentHubController?.renderAgents(this.agents);
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
