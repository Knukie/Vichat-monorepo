import { ensureMarkdownLibs, hardenLinks, renderMarkdown } from '../markdown.js';
import { isCustomerRole } from '../roles.js';

/** @typedef {import('@valki/contracts').ImageMeta} ImageMeta */
/** @typedef {import('@valki/contracts').Role} Role */
/** @typedef {Role} UiRole */
/** @typedef {Partial<ImageMeta> & { dataUrl?: string }} UiMessageImage */
/** @typedef {{ type: UiRole, text: string, images?: UiMessageImage[] }} UiMessageInput */

function isNearBottom(el, thresholdPx = 90) {
  if (!el) return true;
  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
  return remaining < thresholdPx;
}

export function createMessageController({
  messagesEl,
  messagesInner,
  avatarUrl,
  updateDeleteButtonVisibility
}) {
  let botAvatarUrl = avatarUrl;
  let botAvatarAlt = 'Valki icon';

  function scrollToBottom(force = false) {
    if (!messagesEl) return;
    if (force || isNearBottom(messagesEl)) {
      messagesEl.scrollTop = messagesEl.scrollHeight + 10000;
    }
  }

  /** @param {UiMessageInput} param0 */
  async function addMessage({ type, text, images }) {
    if (type !== 'customer') await ensureMarkdownLibs();
    messagesInner.appendChild(createMessageRow({ type, text, images }));
    scrollToBottom(true);
    updateDeleteButtonVisibility?.();
  }

  /** @param {UiMessageInput} param0 */
  function createMessageRow({ type, text, images }) {
    const isCustomer = isCustomerRole(type);
    const row = document.createElement('div');
    row.className = `valki-msg-row ${isCustomer ? 'user' : 'bot'}`;

    if (!isCustomer) {
      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'valki-bot-avatar-wrap';
      const avatar = document.createElement('img');
      avatar.className = 'valki-bot-avatar';
      avatar.src = botAvatarUrl;
      avatar.alt = botAvatarAlt;
      avatarWrap.appendChild(avatar);
      row.appendChild(avatarWrap);
    }

    const bubble = document.createElement('div');
    bubble.className = 'valki-msg-bubble';

    if (!isCustomer) {
      bubble.innerHTML = renderMarkdown(text);
      hardenLinks(bubble);
    } else {
      bubble.textContent = text;
    }

    if (Array.isArray(images) && images.length) {
      const attachmentTray = document.createElement('div');
      attachmentTray.className = 'valki-msg-attachments';
      images.forEach((image) => {
        const src = image?.url || image?.dataUrl;
        if (!src || typeof src !== 'string') return;
        const wrap = document.createElement('div');
        wrap.className = 'valki-msg-attachment';
        const img = document.createElement('img');
        img.src = src;
        img.alt = image?.name || 'attachment';
        img.loading = 'lazy';
        wrap.appendChild(img);
        attachmentTray.appendChild(wrap);
      });
      if (attachmentTray.children.length) {
        bubble.appendChild(attachmentTray);
      }
    }

    row.appendChild(bubble);
    return row;
  }

  function clearMessagesUI() {
    messagesInner.innerHTML = '';
    updateDeleteButtonVisibility?.();
  }

  function createTypingRow() {
    const typingRow = document.createElement('div');
    typingRow.className = 'valki-msg-row bot';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'valki-bot-avatar-wrap';
    const avatar = document.createElement('img');
    avatar.className = 'valki-bot-avatar';
    avatar.src = botAvatarUrl;
    avatar.alt = botAvatarAlt;
    avatarWrap.appendChild(avatar);
    typingRow.appendChild(avatarWrap);

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'valki-msg-bubble';
    bubbleEl.innerHTML = `
    <div class="valki-typing-bar">
      <span class="valki-typing-dots"><span></span><span></span><span></span></span>
      <span class="valki-typing-label">Analyzing the signal…</span>
    </div>`;
    typingRow.appendChild(bubbleEl);

    messagesInner.appendChild(typingRow);
    scrollToBottom(true);

    return typingRow;
  }

  function hasAnyRealMessages() {
    const rows = messagesInner.querySelectorAll('.valki-msg-row');
    for (const row of rows) {
      if (row.querySelector('.valki-typing-bar')) continue;
      return true;
    }
    return false;
  }

  function scrollToBottomHard() {
    if (!messagesEl) return;
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight + 10000;
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight + 10000;
      });
    });
  }

  function setAgentMeta({ avatarUrl: nextAvatar, name }) {
    if (nextAvatar) botAvatarUrl = nextAvatar;
    botAvatarAlt = name ? `${name} icon` : 'Valki icon';
  }

  return {
    addMessage,
    clearMessagesUI,
    createTypingRow,
    hasAnyRealMessages,
    setAgentMeta,
    scrollToBottom,
    scrollToBottomHard
  };
}
