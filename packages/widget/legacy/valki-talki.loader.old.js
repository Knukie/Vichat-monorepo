(() => {
  if (window.__VALKI_TALKI_LOADED__ || document.getElementById('valki-root')) {
    console.log('[ValkiTalki] Early return: already loaded or #valki-root exists.', {
      loaded: !!window.__VALKI_TALKI_LOADED__,
      hasRoot: !!document.getElementById('valki-root')
    });
    return;
  }
  window.__VALKI_TALKI_LOADED__ = true;

  const ensureViewportFitCover = () => {
    const headEl = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    if (!headEl) return;

    let meta = headEl.querySelector('meta[name="viewport"]');
    const content = (meta && meta.getAttribute('content')) || '';
    const parts = content.split(',').map((p) => p.trim()).filter(Boolean);

    const hasWidth = parts.some((p) => p.startsWith('width='));
    const hasInitialScale = parts.some((p) => p.startsWith('initial-scale'));
    const hasViewportFit = parts.some((p) => p.startsWith('viewport-fit'));

    if (!hasWidth) parts.unshift('width=device-width');
    if (!hasInitialScale) parts.unshift('initial-scale=1');
    if (!hasViewportFit) parts.push('viewport-fit=cover');

    const nextContent = parts.join(', ') || 'width=device-width, initial-scale=1, viewport-fit=cover';

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('content', nextContent);
      headEl.prepend(meta);
    } else {
      meta.setAttribute('content', nextContent);
    }
  };

  const getNonce = () => {
    if (window.__VALKI_NONCE__) return window.__VALKI_NONCE__;
    const meta = document.querySelector('meta[name="csp-nonce"]');
    return meta ? meta.getAttribute('content') : null;
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

  const nonce = getNonce();
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

  const resolveBase = () => {
    const current = document.currentScript && document.currentScript.src;
    if (!current) return '';
    return current.split('/').slice(0, -1).join('/');
  };

  const baseUrl = resolveBase();
  const cssHref = baseUrl ? `${baseUrl}/valki-talki.css` : '/valki-talki.css';
  const mainScriptSrc = baseUrl ? `${baseUrl}/valki-talki-main.js` : '/valki-talki-main.js';

  const init = () => {
    if (document.getElementById('valki-root')) {
      console.log('[ValkiTalki] Early return: init found existing #valki-root.');
      return;
    }

    ensureViewportFitCover();

    if (!document.querySelector('link[data-valki-talki]')) {
      const linkTag = document.createElement('link');
      linkTag.rel = 'stylesheet';
      linkTag.href = cssHref;
      linkTag.setAttribute('data-valki-talki', '');
      if (nonce) linkTag.nonce = nonce;
      (document.head || document.documentElement).appendChild(linkTag);
    }

    const container = document.createElement('div');
    container.className = 'valki-talki-root';
    container.setAttribute('data-valki-talki-container', '');
    container.innerHTML = `<canvas id="valki-bg" aria-hidden="true"></canvas>
<div class="valki-root" id="valki-root">
  <div class="valki-landing-shell">
    <!-- Valki Signal Lock -->
    <div class="valki-signal-lock" id="valki-signal-lock" aria-label="Valki Talki. Web3.">
      <div class="valki-signal-line" id="line-main">Crypto Stuck?</div>
      <div class="valki-signal-line muted" id="line-sub">Explained.</div>
    </div>

    <!-- Landing search -->
    <div class="valki-landing-wrap">
      <div class="valki-hero-actions" id="valki-hero-actions">
        <div class="valki-hero-logo" aria-hidden="true">
          <img src="https://valki.wiki/blogmedia/Valki%20Talki.jpg" alt="" loading="lazy" />
        </div>
        <button class="valki-login-btn" id="valki-hero-login-btn" type="button">Login</button>
      </div>

      <form id="valki-search-form" class="valki-search-form" autocomplete="off">
        <div class="valki-search-inner">
          <span class="valki-search-icon" aria-hidden="true">🔎</span>

          <input
            id="valki-search-input"
            class="valki-search-input"
            type="text"
            autocomplete="off"
            placeholder=""
            aria-label="Ask Valki"
            enterkeyhint="send"
          />

          <button class="valki-search-button" type="submit" aria-label="Ask Valki">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 19V5"></path>
              <path d="M5 12l7-7 7 7"></path>
            </svg>
          </button>
        </div>
      </form>
    </div>

    <!-- Badge -->
    <div class="valki-top-badge" id="valki-top-badge" role="button" tabindex="0" aria-label="Open Valki">
      <span class="valki-pulse-dot" aria-hidden="true"></span>
      <span>Valki Talki • <span class="valki-version">v2.0</span></span>
    </div>
  </div>

  <!-- Chat overlay -->
  <div id="valki-overlay" class="valki-overlay" aria-hidden="true">
    <div class="valki-modal" role="dialog" aria-modal="true" aria-labelledby="valki-title">
      <div class="valki-modal-header">
        <div class="valki-modal-header-inner valki-container">
          <div class="valki-header-left">
            <img class="valki-header-avatar" id="valki-header-avatar" src="https://valki.wiki/blogmedia/Valki%20Talki.jpg" alt="Valki avatar" />
            <div class="valki-modal-title-text">
              <span class="name" id="valki-title">Valki Talki</span>
              <span class="session" id="valki-session-label">Valki-session-new</span>
            </div>
          </div>

          <div class="valki-header-actions">
            <div class="valki-header-actions-left">
              <button class="valki-pill primary" id="valki-loginout-btn" type="button" title="Login">Login</button>
              <button class="valki-pill" id="valki-deleteall-btn" type="button" title="Delete all messages">Delete</button>
            </div>
            <button id="valki-close" class="valki-close-btn" type="button" aria-label="Close chat">✕</button>
          </div>
        </div>
      </div>

      <div id="valki-messages" class="valki-messages" role="log" aria-live="polite">
        <div class="valki-messages-inner valki-container" id="valki-messages-inner"></div>
      </div>

      <form id="valki-chat-form" class="valki-chat-form" autocomplete="off">
        <div class="valki-chat-form-inner valki-container">
          <div id="valki-notice-slot"></div>
          <div class="valki-chat-inner">
            <!-- Attach button -->
            <button class="valki-chat-attach" id="valki-chat-attach" type="button" aria-label="Upload image">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.9-9.9a4 4 0 015.66 5.66l-9.9 9.9a2 2 0 01-2.83-2.83l9.19-9.19"></path>
              </svg>
            </button>

            <!-- hidden file input -->
            <input
              id="valki-file-input"
              type="file"
              accept="image/jpeg,image/png"
              multiple
              class="valki-hidden"
            />

            <textarea
              id="valki-chat-input"
              class="valki-chat-input"
              rows="1"
              placeholder="Message Valki (text optional with images)"
              aria-label="Message Valki"
              enterkeyhint="send"
            ></textarea>

            <button class="valki-chat-send" id="valki-chat-send" type="submit" aria-label="Send message">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 19V5"></path>
                <path d="M5 12l7-7 7 7"></path>
              </svg>
            </button>
          </div>

          <!-- Attachments preview tray -->
          <div class="valki-attachments valki-container valki-hidden" id="valki-attachments" aria-label="Attachments"></div>

          <div class="valki-disclaimer valki-container">
            <div>Valki signals may distort. Verify info.</div>
            <button
              type="button"
              class="valki-disclaimer-button"
              id="valki-cookie-prefs-btn"
            >
              See cookie preferences.
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <!-- Auth / Login overlay -->
  <div id="valki-auth-overlay" class="valki-auth-overlay" aria-hidden="true">
    <div class="valki-auth-modal" role="dialog" aria-modal="true" aria-label="Login required">
      <div class="valki-auth-header">
        <img src="https://valki.wiki/blogmedia/Valki%20Talki.jpg" class="valki-auth-avatar" alt="Valki avatar" />
      </div>

      <h2 class="valki-auth-title" id="valki-auth-title">Log in to continue</h2>
      <p class="valki-auth-subtitle" id="valki-auth-subtitle">Sign in to keep your chat history and manage messages.</p>

      <div class="valki-auth-buttons">
        <button type="button" class="valki-auth-btn primary" id="valki-login-discord-btn">
          <span class="valki-auth-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.3 4.7a19.6 19.6 0 0 0-4.9-1.5l-.2.3c1.8.5 2.6 1.2 2.6 1.2a16.4 16.4 0 0 0-5.8-1.8 16.4 16.4 0 0 0-5.8 1.8s.8-.7 2.6-1.2l-.2-.3A19.6 19.6 0 0 0 3.7 4.7C1.4 8 1 11 1 14c1.4 2.1 3.5 3.4 5.7 4 .4-.6.9-1.4 1.2-2.1-.7-.3-1.4-.6-2-.9l.5-.4c1.2.6 2.5 1 3.8 1.2a15 15 0 0 0 3.6 0c1.3-.2 2.6-.6 3.8-1.2l.5.4c-.6.3-1.3.6-2 .9.4.8.8 1.5 1.2 2.1 2.2-.6 4.3-1.9 5.7-4 0-3-.4-6-2.7-9.3ZM9 13.4c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.4-1.4 1.6Zm6 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.4-1.4 1.6Z"></path>
            </svg>
          </span>
          <span>Continue with Discord</span>
        </button>

        <button type="button" class="valki-auth-btn" id="valki-login-google-btn">
          <span class="valki-auth-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.3 14.8 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c5.9 0 9.8-4.1 9.8-9.8 0-.7-.1-1.2-.2-1.8H12z"></path>
            </svg>
          </span>
          <span>Continue with Google</span>
        </button>

        <button type="button" class="valki-auth-btn" id="valki-join-discord-btn">Join Discord server</button>
      </div>

      <div class="valki-auth-note" id="valki-auth-note">Guest limits apply.</div>
      <div class="valki-auth-dismiss" id="valki-auth-dismiss">Not now</div>
    </div>
  </div>

  <!-- Confirm delete all -->
  <div id="valki-confirm-overlay" class="valki-confirm-overlay" aria-hidden="true">
    <div class="valki-confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
      <h3 class="valki-confirm-title">Delete all messages?</h3>
      <p class="valki-confirm-sub">This will remove your chat history for this session.</p>
      <div class="valki-confirm-actions">
        <button type="button" class="valki-confirm-btn" id="valki-confirm-no"><span>No</span></button>
        <button type="button" class="valki-confirm-btn danger" id="valki-confirm-yes"><span>Yes, delete</span></button>
      </div>
    </div>
  </div>

  <!-- Confirm logout -->
  <div id="valki-logout-overlay" class="valki-confirm-overlay valki-hidden" aria-hidden="true">
    <div class="valki-confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm logout">
      <h3 class="valki-confirm-title">Log out?</h3>
      <p class="valki-confirm-sub">You will switch back to guest mode on this device.</p>
      <div class="valki-confirm-actions">
        <button type="button" class="valki-confirm-btn" id="valki-logout-no"><span>Cancel</span></button>
        <button type="button" class="valki-confirm-btn danger" id="valki-logout-yes"><span>Yes, log out</span></button>
      </div>
    </div>
  </div>
</div>`;

    const bgNode = container.querySelector('#valki-bg');
    const root = container.querySelector('#valki-root');
    if (!root) {
      console.log('[ValkiTalki] Early return: #valki-root missing in template.');
      return;
    }

    const mount = document.getElementById('valki-mount') || document.body;
    if (bgNode) mount.appendChild(bgNode);
    mount.appendChild(root);

    const loadScript = (src) => new Promise((resolve, reject) => {
      const scriptTag = document.createElement('script');
      scriptTag.src = src;
      scriptTag.async = true;
      if (nonce) scriptTag.nonce = nonce;
      scriptTag.onload = () => resolve();
      scriptTag.onerror = () => reject(new Error('script load blocked'));
      (document.head || document.documentElement).appendChild(scriptTag);
    });

    let didLog = false;
    const logFailure = (details) => {
      if (didLog) return;
      didLog = true;
      console.log(`[ValkiTalki] Failed to load widget. ${details}`);
    };

    const buildInlineStatus = () => {
      if (inlineBlocked === true) return 'inline scripts blocked (no nonce/unsafe-inline)';
      if (inlineBlocked === false) return 'inline scripts allowed (nonce or unsafe-inline)';
      return 'inline script status unknown';
    };

    loadScript(mainScriptSrc).catch(async (error) => {
      if (!blobAllowed && !window.__VALKI_ALLOW_BLOB__) {
        logFailure(`External script blocked (${error.message}). Blob fallback not attempted (CSP disallows blob:). ${buildInlineStatus()}.`);
        return;
      }
      try {
        const response = await fetch(mainScriptSrc, { credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const jsText = await response.text();
        const blobUrl = URL.createObjectURL(new Blob([jsText], { type: 'application/javascript' }));
        await loadScript(blobUrl);
        URL.revokeObjectURL(blobUrl);
      } catch (blobError) {
        logFailure(`External script blocked (${error.message}). Blob fallback failed (${blobError.message}). ${buildInlineStatus()}.`);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
