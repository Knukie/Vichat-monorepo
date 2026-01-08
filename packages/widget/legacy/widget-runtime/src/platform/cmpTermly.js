import { COOKIE_MODAL_SELECTORS } from '../core/config.js';

export const isCookieModalPresent = () => COOKIE_MODAL_SELECTORS.some((selector) => document.querySelector(selector));

export const createCookieObserver = (onDetect) => {
  const target = document.body;
  if (!target) return null;
  const observer = new MutationObserver((mutations) => {
    if (!mutations.length) return;
    if (!isCookieModalPresent()) return;
    onDetect();
  });
  observer.observe(target, { childList: true, subtree: true });
  return observer;
};
