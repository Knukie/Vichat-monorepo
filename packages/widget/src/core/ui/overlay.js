let lockState = null;
let closeTimerId = null;
const hideTimers = new WeakMap();

export function setVisible(el, on) {
  if (!el) return;
  const show = !!on;
  const existingTimer = hideTimers.get(el);
  if (existingTimer) {
    clearTimeout(existingTimer);
    hideTimers.delete(el);
  }
  if (show) {
    el.style.display = 'flex';
    el.style.pointerEvents = 'auto';
    el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => el.classList.add('is-visible'));
    return;
  }
  el.classList.remove('is-visible');
  el.setAttribute('aria-hidden', 'true');
  el.style.pointerEvents = 'none';
  const hideTimer = window.setTimeout(() => {
    el.style.display = 'none';
    hideTimers.delete(el);
  }, 180);
  hideTimers.set(el, hideTimer);
}

function lockBodyScroll() {
  if (lockState) return;
  const y = window.scrollY || 0;
  const body = document.body;
  lockState = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    touchAction: body.style.touchAction,
    scrollY: y
  };
  body.dataset.valkiScrollY = String(y);
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  body.style.touchAction = 'none';
  document.documentElement.classList.add('valki-chat-open');
  document.documentElement.classList.add('vichat-open');
}

function unlockBodyScroll() {
  if (!lockState) return;
  const body = document.body;
  const state = lockState;
  body.style.position = state?.position || '';
  body.style.top = state?.top || '';
  body.style.left = state?.left || '';
  body.style.right = state?.right || '';
  body.style.width = state?.width || '';
  body.style.overflow = state?.overflow || '';
  body.style.touchAction = state?.touchAction || '';
  document.documentElement.classList.remove('valki-chat-open');
  document.documentElement.classList.remove('vichat-open');
  const y = parseInt(body.dataset.valkiScrollY || '0', 10);
  delete body.dataset.valkiScrollY;
  window.scrollTo({ top: y, behavior: 'auto' });
  lockState = null;
}

export function createOverlayController({
  overlay,
  dialogEl,
  chatInput,
  updateValkiVh,
  updateComposerHeight,
  updateViewportLayout,
  clampComposer,
  scrollToBottom,
  getInitialFocus,
  onOpen,
  onClose
}) {
  let focusTrapActive = false;

  const focusableSelector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusableElements() {
    if (!dialogEl) return [];
    return Array.from(dialogEl.querySelectorAll(focusableSelector)).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return true;
    });
  }

  function focusFirstAvailable() {
    const target = getInitialFocus?.();
    if (target && dialogEl?.contains(target)) {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
      return;
    }
    const focusable = getFocusableElements();
    if (!focusable.length) return;
    try {
      focusable[0].focus({ preventScroll: true });
    } catch {
      focusable[0].focus();
    }
  }

  function onTrapKeydown(event) {
    if (event.key !== 'Tab') return;
    if (!focusTrapActive || !dialogEl) return;
    const focusable = getFocusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !dialogEl.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }
  function isChatOpen() {
    return overlay?.classList.contains('is-visible');
  }

  function openOverlay() {
    if (!overlay) return;
    if (closeTimerId) {
      clearTimeout(closeTimerId);
      closeTimerId = null;
    }
    const wasOpen = isChatOpen();
    updateViewportLayout?.();
    updateValkiVh?.();
    setVisible(overlay, true);
    lockBodyScroll();
    if (!wasOpen) {
      onOpen?.();
    }
    if (!focusTrapActive) {
      focusTrapActive = true;
      document.addEventListener('keydown', onTrapKeydown);
    }
    requestAnimationFrame(() => {
      updateViewportLayout?.();
    });
    setTimeout(() => {
      updateViewportLayout?.();
      updateValkiVh?.();
      updateComposerHeight?.();
      scrollToBottom?.(true);
      focusFirstAvailable();
      clampComposer?.();
      updateComposerHeight?.();
      updateViewportLayout?.();
    }, 60);
  }

  function closeOverlay() {
    if (!overlay) return;
    if (!isChatOpen() && !closeTimerId) return;
    overlay.classList.remove('is-visible');
    if (closeTimerId) {
      clearTimeout(closeTimerId);
    }
    closeTimerId = setTimeout(() => {
      setVisible(overlay, false);
      unlockBodyScroll();
      if (focusTrapActive) {
        document.removeEventListener('keydown', onTrapKeydown);
        focusTrapActive = false;
      }
      onClose?.();
      closeTimerId = null;
    }, 220);
  }

  return { isChatOpen, openOverlay, closeOverlay };
}
