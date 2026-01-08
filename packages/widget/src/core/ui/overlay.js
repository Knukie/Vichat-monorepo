let lockState = null;

export function setVisible(el, on) {
  if (!el) return;
  const show = !!on;
  el.style.display = show ? 'flex' : 'none';
  el.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) {
    requestAnimationFrame(() => el.classList.add('is-visible'));
  } else {
    el.classList.remove('is-visible');
  }
}

function lockBodyScroll() {
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
}

function unlockBodyScroll() {
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
  const y = parseInt(body.dataset.valkiScrollY || '0', 10);
  delete body.dataset.valkiScrollY;
  window.scrollTo({ top: y, behavior: 'auto' });
  lockState = null;
}

export function createOverlayController({ overlay, chatInput, updateComposerHeight, clampComposer, scrollToBottom }) {
  function isChatOpen() {
    return overlay?.classList.contains('is-visible');
  }

  function openOverlay() {
    if (!overlay) return;
    setVisible(overlay, true);
    lockBodyScroll();
    setTimeout(() => {
      updateComposerHeight?.();
      scrollToBottom?.(true);
      try {
        chatInput?.focus({ preventScroll: true });
      } catch {
        chatInput?.focus();
      }
      clampComposer?.();
      updateComposerHeight?.();
    }, 60);
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    setTimeout(() => {
      setVisible(overlay, false);
      unlockBodyScroll();
    }, 220);
  }

  return { isChatOpen, openOverlay, closeOverlay };
}
