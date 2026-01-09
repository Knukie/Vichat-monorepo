import { generateId } from './storage.js';

/** @typedef {import('@valki/contracts').ImageMeta} ImageMeta */
/** @typedef {Partial<ImageMeta> & { id: string, name: string, type: string, dataUrl: string, file?: File }} UiAttachment */

export function createAttachmentController({
  attachTray,
  attachButton,
  fileInput,
  clampComposer,
  updateComposerHeight,
  config
}) {
  /** @type {UiAttachment[]} */
  let attachments = [];

  function showAttachTray() {
    if (!attachTray) return;
    if (!attachments || attachments.length === 0) {
      attachTray.style.display = 'none';
      attachTray.innerHTML = '';
      updateComposerHeight?.();
      return;
    }

    attachTray.style.display = 'flex';
    attachTray.innerHTML = '';

    for (const attachment of attachments) {
      const wrap = document.createElement('div');
      wrap.className = 'valki-attachment';

      const img = document.createElement('img');
      img.src = attachment.dataUrl;
      img.alt = attachment.name || 'attachment';
      img.loading = 'lazy';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'valki-attachment-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove attachment');

      remove.addEventListener('click', () => {
        attachments = attachments.filter((item) => item.id !== attachment.id);
        showAttachTray();
        clampComposer?.();
        updateComposerHeight?.();
      });

      wrap.appendChild(img);
      wrap.appendChild(remove);
      attachTray.appendChild(wrap);
    }

    updateComposerHeight?.();
  }

  function setDisabled(on, parentDisabled = false) {
    const disabled = !!on || !!parentDisabled;
    if (!attachButton) return;
    attachButton.disabled = disabled;
    attachButton.style.opacity = disabled ? '.55' : '';
  }

  function clearAttachments() {
    attachments = [];
    showAttachTray();
  }

  function snapshot() {
    return (attachments || []).map((att) => ({
      name: att?.name || 'image',
      type: att?.type || 'image/jpeg',
      dataUrl: att?.dataUrl || '',
      file: att?.file
    }));
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (attachments.length >= config.maxFiles) break;
      const type = String(file.type || '');
      const ok = type === 'image/jpeg' || type === 'image/png';
      if (!ok) continue;
      if (file.size > config.maxBytes) continue;

      const dataUrl = await readFileAsDataURL(file).catch(() => '');
      if (!dataUrl) continue;

      attachments.push({
        id: generateId('att'),
        name: file.name || 'image',
        type,
        dataUrl,
        file
      });
    }
    showAttachTray();
  }

  return {
    setDisabled,
    addFiles,
    clearAttachments,
    showAttachTray,
    snapshot
  };
}
