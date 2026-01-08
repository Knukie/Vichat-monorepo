(() => {
  if (window.__VALKI_TALKI_LOADED__ || document.querySelector('valki-talki-widget')) return;
  console.log('[ValkiTalki] loader: start');
  window.__VALKI_TALKI_LOADED__ = true;
  const getMeta = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute('content') : null;
  };
  const getCspDirective = (name) => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!meta) return null;
    const content = meta.getAttribute('content') || '';
    const directives = content.split(';').map((item) => item.trim()).filter(Boolean);
    const match = directives.find((item) => item.startsWith(name));
    if (!match) return null;
    return match.slice(name.length).trim();
  };
  const nonce = window.__VALKI_NONCE__ || getMeta('meta[name="csp-nonce"]') || getMeta('meta[property="csp-nonce"]');
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
    if (document.currentScript && document.currentScript.tagName === 'SCRIPT') {
      return document.currentScript;
    }
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    return scripts.find((script) => (script.getAttribute('src') || '').includes('valki-talki.js')) || null;
  };
  const resolveBaseUrl = (scriptEl) => {
    const override = scriptEl ? scriptEl.getAttribute('data-valki-src-base') : null;
    if (override) {
      try {
        return new URL(override, document.baseURI).toString().replace(/\/$/, '');
      } catch (error) {
        return override.replace(/\/$/, '');
      }
    }
    const src = scriptEl ? scriptEl.getAttribute('src') : null;
    if (!src) return '';
    try {
      const resolved = new URL(src, document.baseURI);
      resolved.pathname = resolved.pathname.split('/').slice(0, -1).join('/');
      return `${resolved.origin}${resolved.pathname}`;
    } catch (error) {
      return src.split('/').slice(0, -1).join('/');
    }
  };
  const buildAssetUrl = (base, asset) => {
    if (!base) return `/${asset}`;
    try {
      return new URL(asset, `${base}/`).toString();
    } catch (error) {
      return `${base.replace(/\/$/, '')}/${asset}`;
    }
  };
  const showFailBadge = (reason) => {
    if (document.getElementById('valki-fail-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'valki-fail-badge';
    badge.textContent = 'Valki failed to load';
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
    console.error('[ValkiTalki] loader: failed to load main script', { reason });
  };
  const ensureRoot = () => {
    if (document.getElementById('valki-root')) return;
    const root = document.createElement('div');
    root.id = 'valki-root';
    root.setAttribute('data-valki-root', '1');
    (document.body || document.documentElement).appendChild(root);
  };
  const parseBoolean = (value) => {
    if (value === true || value === false) return value;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return undefined;
  };
  const hasValue = (value) => value !== undefined && value !== null && value !== '';
  const isUnset = (value) => value === undefined || value === null || value === '';
  const setGlobalIfUnset = (key, value) => {
    if (!hasValue(value)) return;
    if (isUnset(window[key])) {
      window[key] = value;
    }
  };
  const readScriptConfig = (script) => {
    if (!script) return;
    const getAttr = (name) => script.getAttribute(`data-valki-${name}`);
    const baseUrl = getAttr('base-url');
    const embedMode = getAttr('embed-mode');
    const mountSelector = getAttr('mount-selector');
    const debug = getAttr('debug');
    const flagsRaw = getAttr('flags');
    setGlobalIfUnset('__VALKI_BASE_URL__', typeof baseUrl === 'string' ? baseUrl.trim() : '');
    if (embedMode === 'iframe' || embedMode === 'shadow') {
      setGlobalIfUnset('__VALKI_EMBED_MODE__', embedMode);
    }
    setGlobalIfUnset('__VALKI_MOUNT_SELECTOR__', typeof mountSelector === 'string' ? mountSelector.trim() : '');
    const debugValue = parseBoolean(debug);
    if (typeof debugValue === 'boolean') {
      setGlobalIfUnset('__VALKI_DEBUG__', debugValue);
    }
    if (typeof flagsRaw === 'string' && flagsRaw.trim()) {
      try {
        const parsed = JSON.parse(flagsRaw);
        if (parsed && typeof parsed === 'object') {
          setGlobalIfUnset('__VALKI_FLAGS__', parsed);
        }
      } catch (error) {
      }
    }
  };
  const scriptEl = findLoaderScript();
  readScriptConfig(scriptEl);
  const baseUrl = resolveBaseUrl(scriptEl);
  const cssFile = (scriptEl && scriptEl.getAttribute('data-valki-css-href')) || 'valki-talki.7ac16ae8.css';
  const mainFile = (scriptEl && scriptEl.getAttribute('data-valki-main-src')) || 'valki-talki-main.4ae6efe7.js';
  const bootstrap = () => {
    const cssHref = buildAssetUrl(baseUrl, cssFile);
    const mainSrc = buildAssetUrl(baseUrl, mainFile);
    console.log('[ValkiTalki] loader: resolved urls', {
      baseUrl,
      cssHref,
      mainScriptSrc: mainSrc
    });
    console.log('[ValkiTalki] loader: assets', {
      cssHref,
      mainScriptSrc: mainSrc,
      baseUrl,
      currentScript: document.currentScript ? document.currentScript.src : null,
      nonce,
      inlineBlocked,
      blobAllowed
    });
    ensureRoot();
    if (!document.querySelector('link[data-valki-widget="1"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      link.setAttribute('data-valki-widget', '1');
      if (nonce) link.nonce = nonce;
      (document.head || document.documentElement).appendChild(link);
    }
    if (!document.querySelector('script[data-valki-widget="1"]')) {
      const script = document.createElement('script');
      script.defer = true;
      script.src = mainSrc;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-valki-widget', '1');
      if (nonce) script.nonce = nonce;
      script.onerror = (event) => {
        const reason = event && event.message ? event.message : `Failed to load ${mainSrc}`;
        showFailBadge(reason);
      };
      (document.head || document.documentElement).appendChild(script);
    }
  };
  bootstrap();
})();
