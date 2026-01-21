export function getDefaultAgents(t) {
  return [
    {
      id: 'reservations',
      name: t('defaultAgents.reservations.name'),
      description: t('defaultAgents.reservations.description'),
      avatarUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=reservations',
      status: 'online'
    },
    {
      id: 'support',
      name: t('defaultAgents.support.name'),
      description: t('defaultAgents.support.description'),
      avatarUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=support',
      status: 'online'
    },
    {
      id: 'sales',
      name: t('defaultAgents.sales.name'),
      description: t('defaultAgents.sales.description'),
      avatarUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=sales',
      status: 'away'
    },
    {
      id: 'concierge',
      name: t('defaultAgents.concierge.name'),
      description: t('defaultAgents.concierge.description'),
      avatarUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=concierge',
      status: 'busy'
    }
  ];
}

export function normalizeAgents(list) {
  if (!Array.isArray(list)) return [];
  const cleaned = [];
  const seen = new Set();
  for (const agent of list) {
    if (!agent || typeof agent !== 'object') continue;
    const id = String(agent.id || '').trim();
    const name = String(agent.name || '').trim();
    if (!id || !name || seen.has(id)) continue;
    cleaned.push({
      id,
      name,
      description: agent.description ? String(agent.description) : '',
      avatarUrl: agent.avatarUrl ? String(agent.avatarUrl) : '',
      status: agent.status ? String(agent.status) : ''
    });
    seen.add(id);
  }
  return cleaned;
}

export function findAgentById(agents, agentId) {
  if (!agentId) return null;
  return agents.find((agent) => agent.id === agentId) || null;
}
