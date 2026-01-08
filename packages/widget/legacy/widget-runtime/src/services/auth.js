export const fetchMe = async ({ baseUrl, token, onUnauthorized }) => {
  if (!token) return null;
  try {
    const response = await fetch(`${baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) {
      if (onUnauthorized) onUnauthorized();
      return null;
    }
    const data = await response.json().catch(() => null);
    if (data && data.loggedIn && data.user) {
      return data.user;
    }
  } catch (error) {
    // Ignore.
  }
  return null;
};

export const openOAuth = (baseUrl, provider) => {
  const returnTo = window.location.origin;
  const url = `${baseUrl}/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`;
  const width = 480;
  const height = 720;
  const y = Math.max(0, (window.screenY || 0) + ((window.outerHeight - height) / 2));
  const x = Math.max(0, (window.screenX || 0) + ((window.outerWidth - width) / 2));
  const popup = window.open(
    url,
    `valki_${provider}_login`,
    `popup=yes,width=${width},height=${height},left=${Math.round(x)},top=${Math.round(y)}`
  );
  if (!popup) {
    window.location.href = url;
    return;
  }
  try {
    popup.focus();
  } catch (error) {
    // Ignore.
  }
};
