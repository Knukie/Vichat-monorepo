import { parsePx } from '../storage.js';
import { t } from '../../i18n/index.js';

function computeLineHeightPx(el) {
  const cs = getComputedStyle(el);
  const fontSize = parsePx(cs.fontSize) || 16;
  const lh = cs.lineHeight;
  if (!lh || lh === 'normal') return Math.round(fontSize * 1.35);
  if (String(lh).endsWith('px')) return Math.round(parsePx(lh));
  const asNum = parseFloat(lh);
  if (Number.isFinite(asNum)) return Math.round(fontSize * asNum);
  return Math.round(fontSize * 1.35);
}

export function createComposerController({ chatInput, chatForm, config, updateComposerHeight }) {
  let clampRaf = 0;

  function clampComposer() {
    if (!chatInput) return;
    if (clampRaf) cancelAnimationFrame(clampRaf);
    clampRaf = requestAnimationFrame(() => {
      clampRaf = 0;
      chatInput.style.height = 'auto';
      const cs = getComputedStyle(chatInput);
      const lh = computeLineHeightPx(chatInput);
      const padTop = parsePx(cs.paddingTop);
      const padBot = parsePx(cs.paddingBottom);
      const lineHeight = Number.isFinite(lh) && lh > 0 ? lh : 22;
      const maxLines = Number.isFinite(config.chatMaxLines) ? config.chatMaxLines : 4;
      const maxH = Math.ceil(lineHeight * maxLines + padTop + padBot);
      const scrollH = chatInput.scrollHeight;
      const next = Math.min(scrollH, maxH);
      chatInput.style.height = `${next}px`;
      chatInput.style.overflowY = scrollH > maxH ? 'auto' : 'hidden';
      updateComposerHeight?.();
    });
  }

  function applyPlaceholders() {
    if (!chatInput) return;
    chatInput.placeholder = t('composer.placeholder');
  }

  if (chatForm && typeof ResizeObserver !== 'undefined') {
    try {
      const ro = new ResizeObserver(() => updateComposerHeight?.());
      ro.observe(chatForm);
    } catch {
      /* ignore */
    }
  }

  return { clampComposer, applyPlaceholders };
}
