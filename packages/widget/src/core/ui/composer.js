import { parsePx } from '../storage.js';

const searchCopy = {
  en: 'What went wrong?',
  nl: 'Wat ging er mis?',
  de: 'Was ist schiefgelaufen?',
  fr: 'Qu’est-ce qui s’est mal passé ?',
  es: '¿Qué salió mal?',
  it: 'Cosa è andato storto?',
  pt: 'O que deu errado?',
  pl: 'Co poszło nie tak?',
  ja: '何がうまくいかなかった？',
  zh: '哪里出了问题？',
  ko: '무엇이 잘못됐나요?',
  ar: 'ما الذي حدث خطأ؟',
  tr: 'Ne yanlış gitti?'
};

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
  function clampComposer() {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    const cs = getComputedStyle(chatInput);
    const lh = computeLineHeightPx(chatInput);
    const padTop = parsePx(cs.paddingTop);
    const padBot = parsePx(cs.paddingBottom);
    const maxH = Math.ceil(lh * config.chatMaxLines + padTop + padBot);
    const scrollH = chatInput.scrollHeight;
    const next = Math.min(scrollH, maxH);
    chatInput.style.height = `${next}px`;
    chatInput.style.overflowY = scrollH > maxH ? 'auto' : 'hidden';
    updateComposerHeight?.();
  }

  function pickLocale() {
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const l of langs) {
      const lang = String(l).toLowerCase();
      const base = lang.split('-')[0];
      if (searchCopy[lang]) return lang;
      if (searchCopy[base]) return base;
    }
    return 'en';
  }

  function applyPlaceholders() {
    if (!chatInput) return;
    const loc = pickLocale();
    const txt = searchCopy[loc] || searchCopy.en;
    chatInput.placeholder = txt;
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
