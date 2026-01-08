function loadScript(src, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      el.onload = null;
      el.onerror = null;
      if (timerId) window.clearTimeout(timerId);
    };
    const timerId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout loading ${src}`));
    }, timeoutMs);
    el.onload = () => {
      cleanup();
      resolve();
    };
    el.onerror = () => {
      cleanup();
      reject(new Error(`Failed loading ${src}`));
    };
    document.head.appendChild(el);
  });
}

let markdownReady = false;
let markdownLoading = null;
let markdownFailed = false;

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function linkifyEscapedText(text) {
  return text.replace(/https?:\/\/[^\s]+/g, (match) => {
    return `<a href="${match}">${match}</a>`;
  });
}

export async function ensureMarkdownLibs() {
  if (markdownReady || markdownFailed) return;
  if (markdownLoading) return markdownLoading;
  markdownLoading = (async () => {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js');
      markdownReady = true;
    } catch {
      markdownFailed = true;
    }
  })();
  return markdownLoading;
}

export function renderMarkdown(text) {
  if (!text) return '';
  if (window.marked) {
    let html = window.marked.parse(text, { breaks: true });
    if (window.DOMPurify) html = window.DOMPurify.sanitize(html);
    return html;
  }
  const escaped = escapeHtml(text).replace(/\n/g, '<br>');
  return linkifyEscapedText(escaped);
}

export function hardenLinks(containerEl) {
  if (!containerEl) return;
  containerEl.querySelectorAll('a').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    if (/^javascript:/i.test(href)) a.removeAttribute('href');
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
}
