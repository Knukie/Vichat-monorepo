/** @typedef {Partial<import('@valki/contracts').ImageMeta> & { dataUrl?: string }} UiMessageImage */

const AVATAR_COLUMN_WIDTH_PX = 28;

function createAvatarWrap({ avatarUrl, avatarAlt }) {
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'valki-bot-avatar-wrap';
  avatarWrap.style.setProperty('--valki-avatar-col', `${AVATAR_COLUMN_WIDTH_PX}px`);
  const avatar = document.createElement('img');
  avatar.className = 'valki-bot-avatar';
  if (avatarUrl) avatar.src = avatarUrl;
  avatar.alt = avatarAlt || 'Assistant avatar';
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
 *  hardenLinks?: (root: HTMLElement) => void
 * }} args
 */
export function createChatMessageRow({
  role,
  text,
  images,
  avatarUrl,
  avatarAlt,
  renderMarkdown,
  hardenLinks
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

  if (role === 'bot' && typeof renderMarkdown === 'function') {
    const rendered = renderMarkdown(text || '');
    if (typeof rendered === 'string') {
      bubble.innerHTML = rendered;
    } else if (rendered && typeof rendered === 'object') {
      bubble.appendChild(rendered);
    }
    if (typeof hardenLinks === 'function') hardenLinks(bubble);
  } else {
    bubble.textContent = text || '';
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

/**
 * @param {{ avatarUrl?: string, avatarAlt?: string, label?: string }} args
 */
export function createTypingRow({ avatarUrl, avatarAlt, label = 'Analyzing the signal…' } = {}) {
  const row = document.createElement('div');
  row.className = 'valki-msg-row bot';
  row.appendChild(createAvatarWrap({ avatarUrl, avatarAlt }));

  const bubble = document.createElement('div');
  bubble.className = 'valki-msg-bubble';
  bubble.innerHTML = `
    <div class="valki-typing-bar">
      <span class="valki-typing-dots"><span></span><span></span><span></span></span>
      <span class="valki-typing-label">${label}</span>
    </div>`;
  row.appendChild(bubble);
  return row;
}
