import { createChatMessageRow } from './chatMessageRow.js';

/** @typedef {import('@valki/contracts').Role} Role */
/** @typedef {Role} UiRole */
/** @typedef {import('@valki/contracts').ImageMeta} ImageMeta */
/** @typedef {{ type: UiRole, text: string, images?: ImageMeta[] }} UiMessageInput */

export function createPinnedUserHeader({ headerEl, headerInner }) {
  function clearPinnedMessage() {
    if (!headerInner) return;
    headerInner.innerHTML = '';
    headerEl?.classList.remove('is-visible');
    headerEl?.classList.add('is-empty');
  }

  /** @param {UiMessageInput} message */
  function setPinnedMessage(message) {
    if (!headerInner || !message) return;
    const { text, images } = message;
    headerInner.innerHTML = '';
    if (!text && (!images || images.length === 0)) {
      clearPinnedMessage();
      return;
    }
    const row = createChatMessageRow({
      role: 'user',
      text: text || '',
      images
    });
    row.classList.remove('valki-hidden');
    headerInner.appendChild(row);
    headerEl?.classList.add('is-visible');
    headerEl?.classList.remove('is-empty');
  }

  clearPinnedMessage();

  return {
    clearPinnedMessage,
    setPinnedMessage
  };
}
