export const updateViewportHeight = (host) => {
  if (window.CSS && CSS.supports('height: 100dvh')) {
    host.style.setProperty('--valki-overlay-height', '100dvh');
  } else {
    host.style.setProperty('--valki-overlay-height', `${window.innerHeight}px`);
  }
};
