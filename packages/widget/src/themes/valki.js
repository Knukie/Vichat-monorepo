import { sharedCss } from './shared.js';
import { widgetHostCss } from './widget-host.js';

export const valkiTheme = {
  name: 'valki',
  title: 'Valki Talki',
  bubbleLabel: 'Open Valki chat',
  overlayTitle: 'Valki Talki',
  avatarUrl: 'https://valki.wiki/blogmedia/Valki%20Talki.jpg',
  css: [widgetHostCss, sharedCss].join('\n'),
  overrideCss: ''
};
