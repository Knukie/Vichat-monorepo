export const renderMessages = ({
  container,
  messages,
  typing,
  renderMarkdown,
  isNearBottom,
  scrollToBottom,
  updateDeleteVisibility,
  forceScroll
}) => {
  if (!container) return;
  const shouldStick = forceScroll || isNearBottom();
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  messages.forEach((message) => {
    const row = document.createElement('div');
    row.className = `message-row ${message.role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (message.role === 'bot') {
      if (typeof renderMarkdown === 'function') {
        bubble.appendChild(renderMarkdown(message.text || ''));
      } else if (message.text) {
        bubble.textContent = message.text;
      }
    } else if (message.text) {
      bubble.textContent = message.text;
    }
    if (message.attachments && message.attachments.length) {
      const attachmentsEl = document.createElement('div');
      attachmentsEl.className = 'message-attachments';
      message.attachments.forEach((attachment) => {
        const wrap = document.createElement('div');
        wrap.className = 'message-attachment';
        const img = document.createElement('img');
        img.alt = 'attachment';
        img.src = attachment.dataUrl;
        wrap.appendChild(img);
        attachmentsEl.appendChild(wrap);
      });
      bubble.appendChild(attachmentsEl);
    }
    row.appendChild(bubble);
    fragment.appendChild(row);
  });
  if (typing) {
    const row = document.createElement('div');
    row.className = 'message-row bot';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const typingEl = document.createElement('div');
    typingEl.className = 'typing';
    typingEl.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    bubble.appendChild(typingEl);
    row.appendChild(bubble);
    fragment.appendChild(row);
  }
  container.appendChild(fragment);
  if (shouldStick) scrollToBottom();
  updateDeleteVisibility();
};

export const renderMarkdown = (text) => {
  const fragment = document.createDocumentFragment();
  const parts = String(text || '').split(/```([\s\S]*?)```/g);
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = part;
      pre.appendChild(code);
      fragment.appendChild(pre);
      return;
    }
    const paragraphs = part.split(/\n{2,}/g);
    paragraphs.forEach((paragraph) => {
      if (!paragraph) return;
      const p = document.createElement('p');
      const lines = paragraph.split(/\n/);
      lines.forEach((line, lineIndex) => {
        appendInlineMarkdown(line, p);
        if (lineIndex < lines.length - 1) {
          p.appendChild(document.createElement('br'));
        }
      });
      fragment.appendChild(p);
    });
  });
  return fragment;
};

const appendInlineMarkdown = (text, container) => {
  const input = String(text || '');
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;
  while ((match = codeRegex.exec(input))) {
    if (match.index > lastIndex) {
      appendLinks(input.slice(lastIndex, match.index), container);
    }
    const code = document.createElement('code');
    code.textContent = match[1];
    container.appendChild(code);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < input.length) {
    appendLinks(input.slice(lastIndex), container);
  }
};

const appendLinks = (text, container) => {
  const markdownRegex = /(!)?\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = markdownRegex.exec(text))) {
    if (match.index > lastIndex) {
      appendBareLinks(text.slice(lastIndex, match.index), container);
    }
    if (match[1]) {
      container.appendChild(document.createTextNode(match[0]));
    } else {
      const link = document.createElement('a');
      link.textContent = match[2];
      link.href = match[3];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.appendChild(link);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    appendBareLinks(text.slice(lastIndex), container);
  }
};

const appendBareLinks = (text, container) => {
  const urlRegex = /https:\/\/[^\s<]+/g;
  let lastIndex = 0;
  let match;
  while ((match = urlRegex.exec(text))) {
    const start = match.index;
    const rawUrl = match[0];
    if (start > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }
    const trimmed = rawUrl.replace(/[),.]+$/, '');
    const link = document.createElement('a');
    link.textContent = trimmed;
    link.href = trimmed;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    container.appendChild(link);
    lastIndex = start + rawUrl.length;
    if (trimmed.length < rawUrl.length) {
      container.appendChild(document.createTextNode(rawUrl.slice(trimmed.length)));
    }
  }
  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
};
