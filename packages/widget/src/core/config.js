export const DEFAULT_BASE_URL = 'https://auth.valki.wiki';

export const DEFAULT_CONSTANTS = {
  avatarUrl: 'https://valki.wiki/blogmedia/Valki%20Talki.jpg',
  guestFreeRoundSize: 3,
  guestMaxRounds: 2,
  chatMaxLines: 4,
  maxFiles: 4,
  maxBytes: 5 * 1024 * 1024,
  bubbleSeenKey: 'valki_bubble_seen_v1',
  authKey: 'valki_auth_token_v1',
  historyKey: 'valki_history_v20',
  selectedAgentKey: 'valki_selected_agent_v1',
  guestMeterKey: 'valki_guest_meter_v1',
  clientIdKey: 'valki_client_id_v20',
  mode: 'default',
  agents: [],
  startAgentId: '',
  copy: {
    genericError: 'Something went wrong talking to Valki.',
    noResponse: '…krrzzzt… no response received.'
  }
};

function normalizeWsPath(path) {
  const cleaned = String(path || '').trim();
  if (!cleaned) return '/ws';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

function buildWebSocketUrl(baseUrl, wsPath) {
  const path = normalizeWsPath(wsPath);
  const fallbackProtocol =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const fallbackHost = typeof window !== 'undefined' ? window.location.host : '';

  try {
    const url = new URL(String(baseUrl || DEFAULT_BASE_URL));
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = path;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    if (fallbackHost) return `${fallbackProtocol}//${fallbackHost}${path}`;
    return `${fallbackProtocol}//localhost${path}`;
  }
}

function buildEndpoints(baseUrl) {
  const trimmed = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  return {
    baseUrl: trimmed,
    apiValki: `${trimmed}/api/valki`,
    apiUpload: `${trimmed}/api/upload`,
    apiMe: `${trimmed}/api/me`,
    apiMessages: `${trimmed}/api/messages`,
    apiClear: `${trimmed}/api/clear`,
    apiImportGuest: `${trimmed}/api/import-guest`,
    authDiscord: `${trimmed}/auth/discord`,
    authGoogle: `${trimmed}/auth/google`,
    discordInvite: 'https://discord.com/invite/vqDJuGJN2u',
    wsPath: normalizeWsPath('/ws'),
    wsUrl: buildWebSocketUrl(trimmed, '/ws')
  };
}

export function buildConfig(overrides = {}) {
  const baseUrl = overrides.baseUrl || DEFAULT_BASE_URL;
  const endpoints = buildEndpoints(baseUrl);
  const wsPath = normalizeWsPath(overrides.wsPath || endpoints.wsPath);
  const wsUrl = overrides.wsUrl || buildWebSocketUrl(baseUrl, wsPath);

  return {
    ...DEFAULT_CONSTANTS,
    ...overrides,
    ...endpoints,
    wsPath,
    wsUrl,
    theme: overrides.theme || 'vichat'
  };
}
