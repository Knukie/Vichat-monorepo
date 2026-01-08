(() => {
  // Prevent double-load
  if (window.__VALKI_TALKI_LOADED__ || window.__VICHAT_WIDGET_LOADED__ || document.querySelector('valki-talki-widget')) return;
  window.__VALKI_TALKI_LOADED__ = true;
  window.__VICHAT_WIDGET_LOADED__ = true;

  console.log('[Vichat] loader: start');

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
    return scripts.find((s) => (s.getAttribute('src') || '').includes('vichat-widget.js')) || null;
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

    // Infer from loader src (/widget/vichat-widget.js -> /widget)
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
    if (document.getElementById('vichat-fail-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'vichat-fail-badge';
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

    console.error('[Vichat] loader: failed to load main script', { reason });
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
    (scriptEl && scriptEl.getAttribute('data-valki-css-href')) || 'vichat-widget.css';
  const mainFile =
    (scriptEl && scriptEl.getAttribute('data-valki-main-src')) || 'vichat-widget-main.js';

  const bootstrap = () => {
    const cssHref = buildAssetUrl(baseUrl, cssFile);
    const mainSrc = buildAssetUrl(baseUrl, mainFile);

    console.log('[Vichat] loader: resolved urls', { baseUrl, cssHref, mainScriptSrc: mainSrc });
    console.log('[Vichat] loader: assets', {
      cssHref,
      mainScriptSrc: mainSrc,
      baseUrl,
      currentScript: document.currentScript ? document.currentScript.src : null,
      nonce,
      inlineBlocked,
      blobAllowed
    });

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
      const script = document.createElement('script');
      script.type = 'module'; // ✅ fixes "Unexpected token 'export'"
      script.src = mainSrc;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-valki-widget', '1');
      if (nonce) script.nonce = nonce;

      script.onload = () => {
        console.log('[Vichat] loader: main loaded');
        // If your main defines the custom element async, this is harmless
        ensureWidgetElement();
      };

      script.onerror = (event) => {
        const reason =
          (event && event.message) ? event.message : `Failed to load ${mainSrc}`;
        showFailBadge(reason);
      };

      (document.head || document.documentElement).appendChild(script);
    }
  };

  bootstrap();
})();
