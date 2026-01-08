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

function buildEndpoints(baseUrl) {
  const trimmed = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  return {
    baseUrl: trimmed,
    apiValki: `${trimmed}/api/valki`,
    apiMe: `${trimmed}/api/me`,
    apiMessages: `${trimmed}/api/messages`,
    apiClear: `${trimmed}/api/clear`,
    apiImportGuest: `${trimmed}/api/import-guest`,
    authDiscord: `${trimmed}/auth/discord`,
    authGoogle: `${trimmed}/auth/google`,
    discordInvite: 'https://discord.com/invite/vqDJuGJN2u'
  };
}

export function buildConfig(overrides = {}) {
  const baseUrl = overrides.baseUrl || DEFAULT_BASE_URL;
  const endpoints = buildEndpoints(baseUrl);

  return {
    ...DEFAULT_CONSTANTS,
    ...overrides,
    ...endpoints,
    theme: overrides.theme || 'vichat'
  };
}
