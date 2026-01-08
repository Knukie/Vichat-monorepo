export function createAuthController({ config, onToken }) {
  const backendOrigin = new URL(config.baseUrl).origin;

  function handleMessage(event) {
    if (event.origin !== backendOrigin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'valki_auth' || !data.token) return;
    onToken?.(String(data.token || ''));
  }

  function attach() {
    window.addEventListener('message', handleMessage);
  }

  function detach() {
    window.removeEventListener('message', handleMessage);
  }

  function openOAuthPopup(authStartUrl, popupName) {
    const returnTo = window.location.origin;
    const w = 480;
    const h = 720;
    const y = Math.max(0, (window.screenY || 0) + (window.outerHeight - h) / 2);
    const x = Math.max(0, (window.screenX || 0) + (window.outerWidth - w) / 2);
    const url = `${authStartUrl}?returnTo=${encodeURIComponent(returnTo)}`;

    const popup = window.open(
      url,
      popupName,
      `popup=yes,width=${w},height=${h},left=${Math.round(x)},top=${Math.round(y)}`
    );

    if (!popup) {
      window.location.href = url;
      return;
    }
    try {
      popup.focus();
    } catch {
      /* ignore */
    }
  }

  return {
    attach,
    detach,
    openDiscordLogin: () => openOAuthPopup(config.authDiscord, 'valki_discord_login'),
    openGoogleLogin: () => openOAuthPopup(config.authGoogle, 'valki_google_login'),
    openDiscordInvite: () => window.open(config.discordInvite, '_blank', 'noopener,noreferrer')
  };
}
