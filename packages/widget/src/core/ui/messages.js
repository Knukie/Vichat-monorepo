import { ensureMarkdownLibs, hardenLinks, renderMarkdown } from '../markdown.js';
import { isCustomerRole } from '../roles.js';
import { t } from '../../i18n/index.js';
import { createChatMessageRow, createTypingRow } from './chatMessageRow.js';

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
  updateDeleteButtonVisibility,
  onScrollUpdate,
  isLoggedIn
}) {
  let botAvatarUrl = avatarUrl;
  let botAvatarAlt = t('avatar.assistantIconDefault');
  let userLabel = t('labels.user');

  function notifyScrollUpdate() {
    if (typeof onScrollUpdate === 'function') {
      onScrollUpdate(isNearBottom(messagesEl));
    }
  }

  function scrollToBottom(force = false) {
    if (!messagesEl) return;
    if (force || isNearBottom(messagesEl)) {
      messagesEl.scrollTop = messagesEl.scrollHeight + 10000;
    }
    notifyScrollUpdate();
  }

  /** @param {UiMessageInput} param0 */
  async function addMessage({ type, text, images }) {
    if (type !== 'customer') await ensureMarkdownLibs();
    const isCustomer = isCustomerRole(type);
    const row = createChatMessageRow({
      role: isCustomer ? 'user' : 'bot',
      text,
      images,
      avatarUrl: botAvatarUrl,
      avatarAlt: botAvatarAlt,
      renderMarkdown: isCustomer ? undefined : renderMarkdown,
      hardenLinks: isCustomer ? undefined : hardenLinks
    });
    messagesInner.appendChild(row);
    scrollToBottom(true);
    updateDeleteButtonVisibility?.();
    notifyScrollUpdate();
    return row;
  }

  async function updateMessageText(row, text, opts = {}) {
    if (!row) return;
    const bubble = row.querySelector('.valki-msg-bubble');
    if (!bubble) return;
    const contentTarget = row.querySelector('.valki-msg-content') || bubble;
    const nextText = text || '';
    if (row.classList.contains('bot')) {
      await ensureMarkdownLibs();
      const rendered = renderMarkdown(nextText);
      if (typeof rendered === 'string') {
        contentTarget.innerHTML = rendered;
      } else if (rendered && typeof rendered === 'object') {
        contentTarget.innerHTML = '';
        contentTarget.appendChild(rendered);
      } else {
        contentTarget.textContent = nextText;
      }
      if (typeof hardenLinks === 'function') hardenLinks(contentTarget);
    } else {
      contentTarget.textContent = nextText;
    }
    scrollToBottom(false);
    notifyScrollUpdate();
  }

  async function promoteTypingRowToMessage(row, text, opts = {}) {
    if (!row) return null;
    row.classList.remove('valki-typing-row');
    let bubble = row.querySelector('.valki-msg-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'valki-msg-bubble';
      row.appendChild(bubble);
    }
    let content = bubble.querySelector('.valki-msg-content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'valki-msg-content';
      bubble.appendChild(content);
    }
    const indicator = row.querySelector('.valki-typing-indicator');
    if (indicator && !bubble.contains(indicator)) {
      bubble.appendChild(indicator);
    }
    await updateMessageText(row, text, opts);
    return row;
  }

  function clearInlineTypingIndicator(row) {
    if (!row) return;
    const indicator = row.querySelector('.valki-typing-indicator');
    if (!indicator) return;
    indicator.remove();
  }

  function clearMessagesUI() {
    messagesInner.innerHTML = '';
    updateDeleteButtonVisibility?.();
    notifyScrollUpdate();
  }

  function removeMessageRow(row) {
    if (!row) return;
    try {
      row.remove();
    } catch {
      /* ignore */
    }
    updateDeleteButtonVisibility?.();
    notifyScrollUpdate();
  }

  function createTypingMessageRow() {
    const existingRows = messagesInner.querySelectorAll('.valki-typing-indicator');
    existingRows.forEach((indicator) => {
      indicator.closest('.valki-msg-row')?.remove();
    });
    const typingRow = createTypingRow({
      avatarUrl: botAvatarUrl,
      avatarAlt: botAvatarAlt,
      status: typeof isLoggedIn === 'function' && isLoggedIn() ? 'authed' : 'guest'
    });
    messagesInner.appendChild(typingRow);
    scrollToBottom(true);
    notifyScrollUpdate();

    return typingRow;
  }

  function removeTypingRows() {
    const existingRows = messagesInner.querySelectorAll('.valki-typing-indicator');
    existingRows.forEach((indicator) => {
      indicator.closest('.valki-msg-row')?.remove();
    });
    notifyScrollUpdate();
  }

  function hasAnyRealMessages() {
    const rows = messagesInner.querySelectorAll('.valki-msg-row');
    for (const row of rows) {
      if (row.querySelector('.valki-typing-indicator')) continue;
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
        notifyScrollUpdate();
      });
    });
  }

  function setAgentMeta({ avatarUrl: nextAvatar, name }) {
    if (nextAvatar) botAvatarUrl = nextAvatar;
    botAvatarAlt = name
      ? t('avatar.assistantIconWithName', { name })
      : t('avatar.assistantIconDefault');
  }

  function setUserLabel(nextLabel) {
    userLabel = nextLabel || t('labels.user');
  }

  return {
    addMessage,
    clearMessagesUI,
    createTypingRow: createTypingMessageRow,
    hasAnyRealMessages,
    setAgentMeta,
    setUserLabel,
    removeTypingRows,
    removeMessageRow,
    promoteTypingRowToMessage,
    clearInlineTypingIndicator,
    updateMessageText,
    isNearBottom: () => isNearBottom(messagesEl),
    scrollToBottom,
    scrollToBottomHard
  };
}
