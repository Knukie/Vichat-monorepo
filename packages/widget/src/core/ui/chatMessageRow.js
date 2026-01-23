import { t } from '../../i18n/index.js';

/** @typedef {Partial<import('@valki/contracts').ImageMeta> & { dataUrl?: string }} UiMessageImage */

const AVATAR_COLUMN_WIDTH_PX = 28;

function createAvatarWrap({ avatarUrl, avatarAlt }) {
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'valki-bot-avatar-wrap';
  avatarWrap.style.setProperty('--valki-avatar-col', `${AVATAR_COLUMN_WIDTH_PX}px`);
  const avatar = document.createElement('img');
  avatar.className = 'valki-bot-avatar';
  if (avatarUrl) avatar.src = avatarUrl;
  avatar.alt = avatarAlt || t('avatar.assistantDefault');
  avatarWrap.appendChild(avatar);
  return avatarWrap;
}

function createAvatarSpacer() {
  const spacer = document.createElement('div');
  spacer.className = 'valki-bot-avatar-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  spacer.style.setProperty('--valki-avatar-col', `${AVATAR_COLUMN_WIDTH_PX}px`);
  return spacer;
}

/**
 * @param {{
 *  role: 'user' | 'bot',
 *  text: string,
 *  images?: UiMessageImage[],
 *  avatarUrl?: string,
 *  avatarAlt?: string,
 *  renderMarkdown?: (text: string) => string | Node,
 *  hardenLinks?: (root: HTMLElement) => void,
 *  authorLabel?: string
 * }} args
 */
export function createChatMessageRow({
  role,
  text,
  images,
  avatarUrl,
  avatarAlt,
  renderMarkdown,
  hardenLinks,
  authorLabel
}) {
  const row = document.createElement('div');
  row.className = `valki-msg-row ${role}`;

  if (role === 'bot') {
    row.appendChild(createAvatarWrap({ avatarUrl, avatarAlt }));
  } else {
    row.appendChild(createAvatarSpacer());
  }

  const bubble = document.createElement('div');
  bubble.className = 'valki-msg-bubble';

  if (role === 'user' && authorLabel) {
    const label = document.createElement('div');
    label.className = 'valki-msg-author';
    label.textContent = authorLabel;
    bubble.appendChild(label);
  }

  const content = document.createElement('div');
  content.className = 'valki-msg-content';
  bubble.appendChild(content);

  const contentTarget = content;

  if (role === 'bot' && typeof renderMarkdown === 'function') {
    const rendered = renderMarkdown(text || '');
    if (typeof rendered === 'string') {
      contentTarget.innerHTML = rendered;
    } else if (rendered && typeof rendered === 'object') {
      contentTarget.appendChild(rendered);
    }
    if (typeof hardenLinks === 'function') hardenLinks(contentTarget);
  } else {
    contentTarget.textContent = text || '';
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
      img.alt = image?.name || t('attachments.attachmentAlt');
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

/**
 * @param {{ avatarUrl?: string, avatarAlt?: string, label?: string }} args
 */
export function createTypingRow({
  avatarUrl,
  avatarAlt,
  label = t('messages.typing'),
  status = 'guest'
} = {}) {
  const row = document.createElement('div');
  row.className = 'valki-msg-row bot valki-typing-row';
  row.appendChild(createAvatarWrap({ avatarUrl, avatarAlt }));

  const indicator = document.createElement('div');
  indicator.className = 'valki-typing-indicator';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-label', label);
  indicator.dataset.status = status === 'authed' ? 'authed' : 'guest';
  row.appendChild(indicator);
  return row;
}
