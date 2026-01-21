import { templateHtml } from './core/ui/template.js';
import { buildConfig } from './core/config.js';
import {
  cleanText,
  clearAuthToken,
  clearGuestHistory,
  getAuthToken,
  getOrCreateClientId,
  loadSelectedAgentId,
  loadGuestHistory,
  markBubbleSeen,
  saveGuestHistory,
  saveSelectedAgentId,
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
import { createWidgetHost } from './core/ui/widgetHost.js';
import { createAuthController } from './core/auth.js';
import { askValki, clearMessages, fetchMe, fetchMessages, importGuestMessages } from './core/api.js';
import { resolveTheme } from './themes/index.js';

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
    this.selectedAgentId = this.currentAgentId;
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
    this.setWidgetState('closed', { emit: false });
    this.bindUi();
    this.scheduleLayoutNudge('mount');
    void this.boot();
  }

  dispatchWidgetEvent(name, detail = {}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
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

    const updateViewportLayout = () => {
      updateComposerHeight();
      this.updateValkiVh();
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

    const clampComposer = () => this.composerController?.clampComposer();

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
      onOpen: () => this.setWidgetState('open'),
      onClose: () => this.setWidgetState('closed')
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
      onSelect: (agentId) => this.handleAgentSelection(agentId)
    });

    this.composerController.applyPlaceholders();
    const onLanguageChange = () => this.composerController?.applyPlaceholders();
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
    const focusComposerOnTouch = (event) => {
      if (!el['valki-chat-input'] || el['valki-chat-input'].disabled) return;
      if (event.type !== 'touchstart' && event.pointerType !== 'touch') return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('button, a, input[type="file"]')) return;
      if (document.activeElement === el['valki-chat-input']) return;
      try {
        el['valki-chat-input'].focus({ preventScroll: true });
      } catch {
        el['valki-chat-input'].focus();
      }
    };
    on(el['valki-chat-shell'], 'pointerdown', stopChatShellPropagation);
    on(el['valki-chat-shell'], 'click', stopChatShellPropagation);
    on(el['valki-chat-shell'], 'touchstart', stopChatShellPropagation, { passive: true });
    on(el['valki-chat-form'], 'pointerdown', focusComposerOnTouch);
    on(el['valki-chat-form'], 'touchstart', focusComposerOnTouch, { passive: true });
    on(el['valki-chat-form'], 'submit', (e) => {
      e.preventDefault();
      const q = cleanText(el['valki-chat-input'].value);
      const hasAttachments = this.attachmentController
        .snapshot()
        .some((attachment) => attachment?.dataUrl || attachment?.file);
      if (!q && !hasAttachments) return;
      el['valki-chat-input'].value = '';
      clampComposer();
      this.ask(q);
    });

    on(el['valki-chat-input'], 'keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el['valki-chat-form'].dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
    on(el['valki-chat-input'], 'input', clampComposer);
    on(el['valki-chat-input'], 'paste', () => setTimeout(clampComposer, 0));
    on(el['valki-chat-input'], 'focus', () => {
      clampComposer();
      scheduleLayoutMetrics();
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

    on(el['valki-close'], 'click', () => this.overlayController.closeOverlay());
    on(el['valki-agent-close'], 'click', () => this.overlayController.closeOverlay());
    on(el['valki-agent-back'], 'click', () => this.showAgentHub());

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
      on(window.visualViewport, 'resize', () => {
        updateViewportLayout();
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
    saveSelectedAgentId(agent.id, this.config);
    this.setView('chat');
    this.applyAgentToHeader(agent);
    this.renderAgentHub();
    await this.loadMessagesForCurrentAgent({ forceOpen: true });
  }

  updateValkiVh() {
    try {
      const vv = window.visualViewport;
      const height = vv?.height || document.documentElement?.clientHeight || window.innerHeight;
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
      sessionLabel.textContent = 'You 🟢';
      this.messageController?.setUserLabel('You');
      return;
    }
    sessionLabel.textContent = 'Guest 🟠';
    this.messageController?.setUserLabel('You');
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
    // TODO: Guest image attachments are saved client-side but not yet imported server-side.
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
      await this.messageController.addMessage({ type: m.role, text: m.text, images: m.images });
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
      await this.messageController.addMessage({ type: m.type, text: m.text, images: m.images });
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
    if (this.isSending) return;
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

    const typingRow = this.messageController.createTypingRow();
    const payloadImages = imagesSnapshot;

    const persistGuestBot = (msg, images) => {
      if (this.isLoggedIn()) return;
      this.guestHistory.push({ type: 'assistant', text: msg, images });
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
        message: q || '',
        clientId: this.clientId,
        images: payloadImages,
        token: this.token,
        config: this.config,
        agentId: this.currentAgentId
      });

      removeTyping();
      const reply = res.ok ? res.message : res.message || this.config.copy.genericError;
      const botImages = Array.isArray(res.images) ? res.images : undefined;
      await this.messageController.addMessage({ type: 'assistant', text: reply });
      persistGuestBot(reply, botImages);
      if (res.ok) this.messageController.scrollToBottomHard();
    } catch (err) {
      console.error(err);
      removeTyping();
      await this.messageController.addMessage({ type: 'assistant', text: this.config.copy.genericError });
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
      this.selectedAgentId = this.currentAgentId;
      this.renderAgentHub();
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
