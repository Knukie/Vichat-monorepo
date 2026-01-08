import ValkiTalkiWidget from './ui/widgetElement.js';
import { VALKI_WIDGET_VERSION } from './core/config.js';
import { getFeatureFlags } from './core/featureFlags.js';
import { runMigrations } from './core/migrations.js';
import { logEvent, setDiagState } from './core/logger.js';
import {
  attachIframeBridge,
  createWidgetElement,
  createWidgetIframe,
  findExistingEmbed,
  getEmbedMode,
  resolveMountTarget,
  resolveShellUrl
} from './platform/embed.js';

(() => {
  const migrated = runMigrations();
  if (migrated) {
    logEvent({ name: 'migration_complete', category: 'embed', status: 'ok' });
  }
  if (!customElements.get('valki-talki-widget')) {
    customElements.define('valki-talki-widget', ValkiTalkiWidget);
  }

  if (findExistingEmbed()) return;

  const flags = getFeatureFlags();
  const mountWidget = () => {
    if (findExistingEmbed()) return;
    const mountTarget = resolveMountTarget();
    if (!mountTarget) return;

    const mode = getEmbedMode();
    const resolvedMode = flags.enableIframeMode ? mode : 'shadow';
    setDiagState({ mode: resolvedMode, version: VALKI_WIDGET_VERSION });
    if (resolvedMode === 'iframe') {
      const shellUrl = resolveShellUrl();
      if (!shellUrl) {
        console.warn('[ValkiTalki] iframe mode unavailable, falling back to shadow mode');
        setDiagState({ mode: 'shadow', version: VALKI_WIDGET_VERSION });
      } else {
        const iframe = createWidgetIframe(shellUrl);
        mountTarget.appendChild(iframe);
        attachIframeBridge(iframe);
        return;
      }
    }

    mountTarget.appendChild(createWidgetElement());
  };

  if (document.body || document.documentElement) {
    mountWidget();
  } else {
    window.addEventListener('DOMContentLoaded', mountWidget, { once: true });
  }
})();
