import { sharedCss } from './shared.js';
import { widgetHostCss } from './widget-host.js';

export const vichatTheme = {
  name: 'vichat',
  title: 'ViChat',
  bubbleLabel: 'Open ViChat chat',
  overlayTitle: 'ViChat',
  avatarUrl: 'https://valki.wiki/blogmedia/Valki%20Talki.jpg',
  css: [widgetHostCss, sharedCss].join('\n'),
  overrideCss: ''
};
