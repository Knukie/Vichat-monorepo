function createStatusDot(status) {
  if (!status) return null;
  const dot = document.createElement('span');
  dot.className = `valki-agent-status ${status}`;
  dot.setAttribute('aria-hidden', 'true');
  return dot;
}

function createAgentRow(agent, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'valki-agent-row';
  button.dataset.agentId = agent.id;
  button.setAttribute('aria-label', `Chat with ${agent.name}`);

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'valki-agent-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.className = 'valki-agent-avatar';
  avatar.src = agent.avatarUrl;
  avatar.alt = `${agent.name} avatar`;
  avatarWrap.appendChild(avatar);

  const statusDot = createStatusDot(agent.status);
  if (statusDot) avatarWrap.appendChild(statusDot);

  const content = document.createElement('div');
  content.className = 'valki-agent-content';

  const name = document.createElement('div');
  name.className = 'valki-agent-name';
  name.textContent = agent.name;

  const description = document.createElement('div');
  description.className = 'valki-agent-desc';
  description.textContent = agent.description || '';

  content.appendChild(name);
  content.appendChild(description);

  const meta = document.createElement('div');
  meta.className = 'valki-agent-meta';
  meta.textContent = agent.status ? agent.status : '';

  button.appendChild(avatarWrap);
  button.appendChild(content);
  button.appendChild(meta);

  button.addEventListener('click', () => onSelect?.(agent.id));

  return button;
}

export function createAgentHubController({ hubEl, listEl, emptyEl, onSelect }) {
  function renderAgents(agents = []) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const safeAgents = Array.isArray(agents) ? agents : [];
    if (!safeAgents.length) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    safeAgents.forEach((agent) => {
      listEl.appendChild(createAgentRow(agent, onSelect));
    });
  }

  function setVisible(isVisible) {
    if (!hubEl) return;
    hubEl.style.display = isVisible ? 'flex' : 'none';
  }

  return { renderAgents, setVisible };
}
