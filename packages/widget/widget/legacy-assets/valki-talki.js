(() => {
  // Prevent double-load
  if (window.__VALKI_TALKI_LOADED__ || window.__VICHAT_WIDGET_LOADED__ || document.querySelector('valki-talki-widget')) return;
  window.__VALKI_TALKI_LOADED__ = true;
  window.__VICHAT_WIDGET_LOADED__ = true;

  const log = (...args) => {
    try {
      console.log(...args);
    } catch (_) {
      // noop
    }
  };

  const logError = (...args) => {
    try {
      console.error(...args);
    } catch (_) {
      // noop
    }
  };

  log('[ValkiTalki] loader: start');

  const getMeta = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute('content') : null;
  };

  const resolveTenant = (value) => (value === 'valki-tanki' ? 'valki-tanki' : 'valki');

  const getCspDirective = (name) => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!meta) return null;
    const content = meta.getAttribute('content') || '';
    const directives = content
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
    const match = directives.find((item) => item.startsWith(name));
    if (!match) return null;
    return match.slice(name.length).trim();
  };

  // CSP nonce support
  const nonce =
    window.__VALKI_NONCE__ ||
    getMeta('meta[name="csp-nonce"]') ||
    getMeta('meta[property="csp-nonce"]');

  const scriptSrcDirective = getCspDirective('script-src');
  const inlineBlocked = (() => {
    if (nonce) return false;
    if (!scriptSrcDirective) return null;
    return !scriptSrcDirective.includes("'unsafe-inline'");
  })();

  const blobAllowed = (() => {
    if (!scriptSrcDirective) return false;
    return scriptSrcDirective.includes('blob:');
  })();

  const findLoaderScript = () => {
    // Best-effort: currentScript when available
    if (document.currentScript && document.currentScript.tagName === 'SCRIPT') {
      return document.currentScript;
    }
    // Fallback: search scripts by src
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    return scripts.find((s) => (s.getAttribute('src') || '').includes('valki-talki.js')) || null;
  };

  const resolveBaseUrl = (scriptEl) => {
    // Manual override
    const override = scriptEl ? scriptEl.getAttribute('data-valki-src-base') : null;
    if (override) {
      try {
        return new URL(override, document.baseURI).toString().replace(/\/$/, '');
      } catch {
        return String(override).replace(/\/$/, '');
      }
    }

    // Infer from loader src (/widget/valki-talki.js -> /widget)
    const src = scriptEl ? scriptEl.getAttribute('src') : null;
    if (!src) return '';
    try {
      const resolved = new URL(src, document.baseURI);
      resolved.pathname = resolved.pathname.split('/').slice(0, -1).join('/');
      return `${resolved.origin}${resolved.pathname}`;
    } catch {
      return src.split('/').slice(0, -1).join('/');
    }
  };

  const buildAssetUrl = (base, asset) => {
    if (!base) return `/${asset}`;
    try {
      return new URL(asset, `${base}/`).toString();
    } catch {
      return `${base.replace(/\/$/, '')}/${asset}`;
    }
  };

  const showFailBadge = (reason) => {
    if (document.getElementById('valki-fail-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'valki-fail-badge';
    badge.textContent = `${displayName} failed to load`;
    badge.style.position = 'fixed';
    badge.style.right = '16px';
    badge.style.bottom = '16px';
    badge.style.background = '#b91c1c';
    badge.style.color = '#fff';
    badge.style.padding = '8px 12px';
    badge.style.font = '12px/1.2 system-ui, sans-serif';
    badge.style.borderRadius = '999px';
    badge.style.zIndex = '2147483646';
    (document.body || document.documentElement).appendChild(badge);

    logError('[ValkiTalki] loader: failed to load main script', { reason });
  };

  const ensureRoot = () => {
    if (document.getElementById('valki-root')) return;
    const root = document.createElement('div');
    root.id = 'valki-root';
    root.setAttribute('data-valki-root', '1');
    (document.body || document.documentElement).appendChild(root);
  };

  const ensureWidgetElement = () => {
    if (document.querySelector('valki-talki-widget')) return;
    const el = document.createElement('valki-talki-widget');
    (document.body || document.documentElement).appendChild(el);
  };

  const scriptEl = findLoaderScript();
  const tenant = resolveTenant(
    (scriptEl && scriptEl.getAttribute('data-vichat-tenant')) || window.__VICHAT_TENANT__
  );
  window.__VICHAT_TENANT__ = tenant;
  const displayName = tenant === 'valki-tanki' ? 'Valki Talki' : 'Valki';
  const baseUrl = resolveBaseUrl(scriptEl);

  // ✅ Stable defaults (no manifest)
  const cssFile =
    (scriptEl && scriptEl.getAttribute('data-valki-css-href')) || 'valki-talki.css';
  const mainFile =
    (scriptEl && scriptEl.getAttribute('data-valki-main-src')) || 'valki-talki-main.js';

  const bootstrap = () => {
    const cssHref = buildAssetUrl(baseUrl, cssFile);
    const mainSrc = buildAssetUrl(baseUrl, mainFile);

    log('[ValkiTalki] loader: resolved urls', { baseUrl, cssHref, mainScriptSrc: mainSrc });
    log('[ValkiTalki] loader: assets', {
      cssHref,
      mainScriptSrc: mainSrc,
      baseUrl,
      currentScript: document.currentScript ? document.currentScript.src : null,
      nonce,
      inlineBlocked,
      blobAllowed
    });

    const inspectMainResponse = async () => {
      if (typeof fetch !== 'function') return null;
      try {
        const response = await fetch(mainSrc, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
          mode: 'cors'
        });
        const contentType = (response.headers && response.headers.get('content-type')) || '';
        if (contentType.includes('text/html')) {
          logError('[ValkiTalki] loader: main script returned HTML', { mainSrc, contentType });
          showFailBadge('Main script returned HTML');
          return false;
        }
        const snippet = await response
          .text()
          .then((text) => (text || '').slice(0, 200).trim().toLowerCase())
          .catch(() => '');
        if (snippet.startsWith('<!doctype html') || snippet.startsWith('<html')) {
          logError('[ValkiTalki] loader: main script HTML response detected', { mainSrc });
          showFailBadge('Main script HTML response detected');
          return false;
        }
        return true;
      } catch (error) {
        logError('[ValkiTalki] loader: main script probe failed (non-blocking)', {
          mainSrc,
          error
        });
        return null;
      }
    };

    ensureRoot();

    // CSS
    if (!document.querySelector('link[data-valki-widget="1"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      link.setAttribute('data-valki-widget', '1');
      if (nonce) link.nonce = nonce;
      (document.head || document.documentElement).appendChild(link);
    }

    // MAIN (✅ must be module to allow `export`)
    if (!document.querySelector('script[data-valki-widget="1"]')) {
      const timeoutId = window.setTimeout(() => {
        showFailBadge('Main script load timeout (8s)');
      }, 8000);

      void inspectMainResponse();

      const script = document.createElement('script');
      script.type = 'module'; // ✅ fixes "Unexpected token 'export'"
      script.src = mainSrc;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-valki-widget', '1');
      if (nonce) script.nonce = nonce;

      script.onload = () => {
        window.clearTimeout(timeoutId);
        log('[ValkiTalki] loader: main loaded');
        // If your main defines the custom element async, this is harmless
        ensureWidgetElement();
      };

      script.onerror = (event) => {
        window.clearTimeout(timeoutId);
        const reason =
          event && event.message
            ? event.message
            : `Failed to load ${mainSrc}`;
        showFailBadge(reason);
      };

      (document.head || document.documentElement).appendChild(script);
    }
  };

  try {
    bootstrap();
  } catch (error) {
    logError('[ValkiTalki] loader: bootstrap failure', error);
    showFailBadge(error && error.message ? error.message : 'Bootstrap error');
  }
})();
