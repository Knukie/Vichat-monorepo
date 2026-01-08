import { valkiTheme } from './valki.js';
import { vichatTheme } from './vichat.js';

const THEMES = {
  vichat: vichatTheme,
  valki: valkiTheme
};

export function resolveTheme(name) {
  if (name && THEMES[name]) return THEMES[name];
  return vichatTheme;
}

export function getAllThemes() {
  return Object.values(THEMES);
}
