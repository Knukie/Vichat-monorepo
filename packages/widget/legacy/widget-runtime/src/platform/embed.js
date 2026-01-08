import { BASE_URL, EMBED_MODE, MOUNT_SELECTOR } from '../core/config.js';

const EMBED_IFRAME_SELECTOR = 'iframe[data-valki-embed="iframe"]';
const EMBED_WIDGET_SELECTOR = 'valki-talki-widget';

const normalizeMode = (mode) => (mode === 'iframe' ? 'iframe' : 'shadow');

export const getEmbedMode = () => normalizeMode(EMBED_MODE);

export const findExistingEmbed = () => {
  return document.querySelector(`${EMBED_IFRAME_SELECTOR}, ${EMBED_WIDGET_SELECTOR}`);
};

export const resolveMountTarget = () => {
  if (MOUNT_SELECTOR) {
    const target = document.querySelector(MOUNT_SELECTOR);
    if (target) return target;
  }
  return document.body || document.documentElement;
};

export const resolveShellUrl = () => {
  if (typeof window.__VALKI_SHELL_URL__ === 'string' && window.__VALKI_SHELL_URL__) {
    return window.__VALKI_SHELL_URL__;
  }
  const base = String(BASE_URL || '').replace(/\/$/, '');
  if (!base) return '';
  let shellUrl = '';
  try {
    const url = new URL('/widget/shell.html', base);
    url.searchParams.set('base', BASE_URL);
    shellUrl = url.toString();
  } catch (error) {
    shellUrl = `${base}/widget/shell.html?base=${encodeURIComponent(BASE_URL)}`;
  }
  if (typeof window !== 'undefined' && window.location && base === window.location.origin) {
    const localUrl = new URL('/public/shell.html', window.location.origin);
    localUrl.searchParams.set('base', BASE_URL);
    return localUrl.toString();
  }
  return shellUrl;
};

export const applyIframeState = (iframe, state) => {
  iframe.dataset.valkiState = state;
  iframe.style.border = '0';
  iframe.style.background = 'transparent';
  iframe.style.position = 'fixed';
  iframe.style.transition = 'opacity 0.2s ease';
  iframe.style.opacity = '1';
  if (state === 'open') {
    iframe.style.inset = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.zIndex = '2147483647';
  } else {
    iframe.style.right = '20px';
    iframe.style.bottom = '20px';
    iframe.style.width = '180px';
    iframe.style.height = '80px';
    iframe.style.inset = 'auto';
    iframe.style.zIndex = '2147483645';
  }
};

export const createWidgetIframe = (shellUrl) => {
  const iframe = document.createElement('iframe');
  iframe.src = shellUrl;
  iframe.title = 'Valki Talki';
  iframe.setAttribute('data-valki-embed', 'iframe');
  iframe.setAttribute('aria-label', 'Valki Talki');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('referrerpolicy', 'origin');
  applyIframeState(iframe, 'closed');
  return iframe;
};

export const createWidgetElement = () => {
  const widget = document.createElement('valki-talki-widget');
  widget.setAttribute('data-valki-embed', 'shadow');
  return widget;
};

export const attachIframeBridge = (iframe) => {
  let iframeOrigin = '';
  try {
    iframeOrigin = new URL(iframe.src).origin;
  } catch (error) {
    iframeOrigin = '';
  }
  if (!iframeOrigin) return;

  const handler = (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (event.origin !== iframeOrigin) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'valki_embed') return;
    if (data.action === 'open') {
      applyIframeState(iframe, 'open');
    }
    if (data.action === 'close') {
      applyIframeState(iframe, 'closed');
    }
  };

  window.addEventListener('message', handler);
};
