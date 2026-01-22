// Generated from src/themes/shared.css
export const sharedCss = `/* =========================================================
   VALKI — Theme + Layout Locks
========================================================= */
#valki-root{
  /* Theme */
  --bg: #0b0b0b;
  --surface: rgba(255,255,255,.04);
  --surface-2: rgba(255,255,255,.06);
  --border: rgba(255,255,255,.10);
  --border-2: rgba(255,255,255,.16);
  --text: rgba(255,255,255,.92);
  --muted: rgba(255,255,255,.60);
  --muted-2: rgba(255,255,255,.45);

  --brand: #f15a24;
  --brand-2: #ff7a45;
  --ring: rgba(241,90,36,.22);

  --btn-fill: #e7e7e7;
  --btn-text: #0b0b0b;

  /* HARD layout lock (ChatGPT feel) */
  --col: 760px;
  --gutter: 24px;

  --radius: 14px;
  --radius-pill: 999px;

  --shadow-1: 0 12px 40px rgba(0,0,0,.55);
  --shadow-2: 0 20px 70px rgba(0,0,0,.70);
  --valki-backdrop: rgba(0,0,0,.35);
  --valki-backdrop-fallback: rgba(0,0,0,.55);
  --valki-backdrop-blur: 10px;
  --valki-panel-bg: rgba(12,12,12,.92);
  --valki-panel-border: rgba(255,255,255,.06);
  --valki-panel-shadow: 0 30px 70px rgba(0,0,0,.55);
  --valki-panel-frame-border-soft: rgba(255,255,255,.04);
  --valki-panel-frame-shadow-soft: 0 18px 50px rgba(0,0,0,.38);
  --valki-panel-frame-border-none: transparent;
  --valki-panel-frame-shadow-none: none;
  --valki-panel-frame-border: var(--valki-panel-frame-border-soft);
  --valki-panel-frame-shadow: var(--valki-panel-frame-shadow-soft);

  --font: system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  -webkit-text-size-adjust: 100%;

  --valki-vh: 1dvh;
  --vvh: calc(var(--valki-vh, 1vh) * 100);

  /* (Fallback) composer height – als je later JS toevoegt kan dit dynamisch */
  --composer-h: 110px;

  --valki-chat-pad-bottom: calc(env(safe-area-inset-bottom) + 10px);
  --keyboard-bottom: 0px;

  /* Background + vignette + blur */
  --chat-bg-image: url("https://valki.wiki/onewebmedia/Valki%20Talki%20background___serialized1.jpg");
  --chat-bg-color: #070707;

  --vignette-strength: .58;  /* iets steviger voor blok-contrast */
  --side-blur: 30px;
  --side-tint: rgba(0,0,0,.18); /* transparanter zodat bg sterker doorkomt */

  /* Chat block */
  --chat-block-bg: rgba(8,8,8,.78);           /* “massief blok” */
  --chat-block-border: rgba(255,255,255,.10);
  --chat-block-blur: 10px;
}

@supports (height: 100dvh){
  #valki-root{
    --vvh: 100dvh;
  }
}

#valki-root, #valki-root *{ box-sizing:border-box; }

#valki-root [data-panel-frame="none"]{
  --valki-panel-frame-border: var(--valki-panel-frame-border-none);
  --valki-panel-frame-shadow: var(--valki-panel-frame-shadow-none);
}

#valki-root [data-panel-frame="soft"]{
  --valki-panel-frame-border: var(--valki-panel-frame-border-soft);
  --valki-panel-frame-shadow: var(--valki-panel-frame-shadow-soft);
}

#valki-root button{
  all: unset;
  box-sizing:border-box;
  font: inherit;
  color: inherit;
  cursor:pointer;
}

/* iOS caret metrics: avoid all: unset on inputs/textareas. */
#valki-root input,
#valki-root textarea{
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
  font: inherit;
  color: inherit;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  display: block;
}

#valki-root input, #valki-root textarea{ cursor:text; }

/* Focus ring alleen voor knoppen (keyboard users) */
#valki-root button:focus-visible{
  outline: 1px solid var(--brand);
  outline-offset: 1px;
}

/* Geen oranje outline op input/textarea */
#valki-root input:focus-visible,
#valki-root textarea:focus-visible{
  outline: none !important;
}

#valki-root ::selection{ background: rgba(140,170,255,.14); }
#valki-root ::-moz-selection{ background: rgba(140,170,255,.14); }

@supports (-webkit-touch-callout: none){
  #valki-root input, #valki-root textarea{ font-size:16px; }
}

/* Hide background when modal is open to avoid double-blur look */
html.valki-chat-open #valki-root #valki-bg{
  display:none !important;
}

/* =========================================================
   Root container
========================================================= */
#valki-root{
  position:relative;
  z-index:1;
  min-height:var(--vvh);
  width:100%;
  margin:0;
  padding: env(safe-area-inset-top) 0 0;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
}

/* =========================================================
   Floating Chat Bubble Launcher (Beautiful)
========================================================= */
#valki-root .valki-bubble{
  position: fixed;
  right: var(--widget-launcher-right, 18px);
  bottom: var(--widget-launcher-bottom, calc(18px + env(safe-area-inset-bottom)));
  width: var(--widget-launcher-bubble-size, 64px);
  height: var(--widget-launcher-bubble-size, 64px);
  border-radius: 999px;

  /* Subtle gradient + inner ring */
  background:
    radial-gradient(140% 140% at 30% 25%, rgba(255,255,255,.28), rgba(255,255,255,0) 45%),
    linear-gradient(145deg, var(--brand-2), var(--brand));
  box-shadow:
    0 26px 70px rgba(0,0,0,.62),
    0 0 0 1px rgba(255,255,255,.18) inset,
    0 8px 24px rgba(241,90,36,.22);

  display:flex;
  align-items:center;
  justify-content:center;

  z-index: var(--widget-launcher-z, 2147482998);
  transform: translateZ(0);
  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
}

#valki-root .valki-bubble:hover{
  transform: translateY(-2px);
  filter: brightness(1.04);
  box-shadow:
    0 30px 85px rgba(0,0,0,.68),
    0 0 0 1px rgba(255,255,255,.22) inset,
    0 10px 32px rgba(241,90,36,.26);
}

#valki-root .valki-bubble:active{
  transform: translateY(0px) scale(.99);
}

#valki-root .valki-bubble-icon{
  width: 28px;
  height: 28px;
  color: rgba(255,255,255,.96);
  filter: drop-shadow(0 8px 12px rgba(0,0,0,.35));
}

#valki-root .valki-bubble-badge{
  position:absolute;
  top: 10px;
  right: 10px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ff3b30;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -.02em;
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow: 0 14px 26px rgba(0,0,0,.55);
  border: 1px solid rgba(255,255,255,.22);
}

#valki-root .valki-bubble-ping{
  position:absolute;
  inset: -6px;
  border-radius: 999px;
  border: 2px solid rgba(241,90,36,.35);
  animation: valkiPing 2.2s infinite;
  pointer-events:none;
  opacity:.8;
}

@keyframes valkiPing{
  0%{ transform: scale(.90); opacity:.45; }
  65%{ transform: scale(1.10); opacity:0; }
  100%{ transform: scale(1.10); opacity:0; }
}

/* Hide bubble while chat is open */
html.valki-chat-open #valki-root .valki-bubble{
  opacity: 0;
  pointer-events:none;
  transform: translateY(10px);
}

/* =========================================================
   Overlays / Fullscreen chat (iOS/rotate/keyboard-proof)
   - Uses your JS-driven --vvh (via --valki-vh)
========================================================= */

/* Make sure the actual overlay nodes sit above everything */
#valki-root #valki-overlay,
#valki-root #valki-auth-overlay,
#valki-root #valki-confirm-overlay,
#valki-root #valki-logout-overlay{
  z-index: var(--widget-overlay-z, 2147483000) !important;
}

/* Base overlay layout */
#valki-root .valki-overlay,
#valki-root .valki-auth-overlay,
#valki-root .valki-confirm-overlay,
#valki-root .valki-logout-overlay{
  position: fixed;
  inset: 0;
  overflow: hidden;

  /* IMPORTANT: var(--vvh) = calc(var(--valki-vh) * 100) */
  height: min(var(--vvh), 100dvh);
  width: 100%;

  /* default hidden state */
  display: none;
  opacity: 0;
  pointer-events: none;

  /* nice fade */
  transition: opacity .18s ease;
  isolation: isolate;

  background: var(--bg);

  /* flex baseline (enabled when .is-visible) */
  align-items: stretch;
  justify-content: center;
}

/* Main chat overlay fills vertically */
#valki-root .valki-overlay{
  align-items: stretch;
  justify-content: center;
}

/* Centered overlays (auth/confirm/logout) */
#valki-root .valki-auth-overlay,
#valki-root .valki-confirm-overlay,
#valki-root .valki-logout-overlay{
  background: rgba(0,0,0,.82);
  align-items: center;
  justify-content: center;
}

@media (min-width: 1024px){
  #valki-root #valki-overlay[data-layout="desktop"]{
    background: var(--valki-backdrop);
    backdrop-filter: blur(var(--valki-backdrop-blur));
    -webkit-backdrop-filter: blur(var(--valki-backdrop-blur));
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  @media (min-width: 1024px){
    #valki-root #valki-overlay[data-layout="desktop"]{
      background: var(--valki-backdrop-fallback);
    }
  }
}

/* Fullscreen modal follows the same vh logic */
#valki-root .valki-modal{
  height: min(var(--vvh), 100dvh);
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

#valki-root .valki-chat-shell{
  height: min(var(--vvh), 100dvh);
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

#valki-root .valki-sidebar{
  display: none;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

/* Visible state */
#valki-root .valki-overlay.is-visible,
#valki-root .valki-auth-overlay.is-visible,
#valki-root .valki-confirm-overlay.is-visible,
#valki-root .valki-logout-overlay.is-visible{
  display: flex;
  opacity: 1;
  pointer-events: auto;
}

/* ===============================
   AUTH MODAL – FIXED CARD LAYOUT
================================ */

#valki-root .valki-auth-modal{
  width: 100%;
  max-width: 420px;
  margin: 0 16px;

  background: rgba(12,12,12,.92);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);

  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 30px 90px rgba(0,0,0,.65);

  padding: 22px 22px 20px;
  text-align: center;

  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Avatar/logo bovenin netjes klein */
#valki-root .valki-auth-avatar{
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin-bottom: 14px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.04);
}

/* Titel */
#valki-root .valki-auth-title{
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}

/* Subtitel */
#valki-root .valki-auth-subtitle{
  font-size: 13px;
  color: rgba(255,255,255,.65);
  margin-bottom: 18px;
}

/* Buttons stack */
#valki-root .valki-auth-buttons{
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

/* Buttons */
#valki-root .valki-auth-btn{
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.14);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

#valki-root .valki-auth-btn.primary{
  background: #f2f2f2;
  color: #0b0b0b;
}

#valki-root .valki-auth-btn.danger{
  background: #ff4b4b;
  border-color: rgba(255,255,255,.18);
  color: #fff;
}

/* Footer tekst */
#valki-root .valki-auth-note{
  font-size: 11px;
  color: rgba(255,255,255,.55);
  margin-bottom: 8px;
}

/* Dismiss */
#valki-root .valki-auth-dismiss{
  font-size: 12px;
  color: rgba(255,255,255,.7);
  cursor: pointer;
}

/* ===============================
   AUTH BUTTON HOVER – FIXED
================================ */

#valki-root .valki-auth-btn{
  cursor: pointer;
  transition:
    transform .12s ease,
    box-shadow .12s ease,
    border-color .12s ease,
    background .12s ease,
    filter .12s ease;
}

/* ---------- DEFAULT (dark buttons) ---------- */
@media (hover:hover){
  #valki-root .valki-auth-btn:not(.primary):hover{
    transform: translateY(-1px);
    background: rgba(255,255,255,.09);
    border-color: rgba(255,255,255,.22);
    box-shadow: 0 14px 34px rgba(0,0,0,.35);
  }
}

/* ---------- PRIMARY (white button) ---------- */
@media (hover:hover){
  #valki-root .valki-auth-btn.primary:hover{
    transform: translateY(-1px);
    background: #f2f2f2;              /* blijft wit */
    border-color: rgba(0,0,0,.08);
    box-shadow: 0 18px 44px rgba(0,0,0,.38);
    filter: brightness(1.01);         /* subtiel, geen grijs */
  }
}

@media (hover:hover){
  #valki-root .valki-auth-btn.danger:hover{
    transform: translateY(-1px);
    background: #ff5c5c;
    border-color: rgba(255,255,255,.28);
    box-shadow: 0 18px 44px rgba(0,0,0,.38);
  }
}

/* Pressed */
#valki-root .valki-auth-btn:active{
  transform: translateY(0) scale(.99);
}

/* Keyboard focus */
#valki-root .valki-auth-btn:focus-visible{
  outline: none;
  box-shadow:
    0 0 0 2px var(--ring),
    0 18px 44px rgba(0,0,0,.38);
}

/* =========================================================
   Modal + Background + Vignette + Side Blur  (FIX)
========================================================= */
#valki-root .valki-modal{
  width:100vw;
  height:100vh;
  height:100dvh;

  /* IMPORTANT: use your background image variable */
  background:
    var(--chat-bg-image) center / cover no-repeat,
    linear-gradient(#0c0c0c,#070707);
  background-color: var(--chat-bg-color);

  border-radius:0;
  overflow:hidden;
  display:flex;
  flex-direction:column;

  position: relative;
  isolation: isolate;

  /* Outer “block presence” */
  box-shadow:
    0 0 0 1px rgba(255,255,255,.04),
    0 30px 80px rgba(0,0,0,.65);
}

/* =========================================================
   VIGNETTE + SIDE BLUR OUTSIDE CHAT BLOCK (REPLACES OLD ::before/::after)
========================================================= */

/* Put vignette inside modal background layers */
#valki-root .valki-modal{
  background:
    /* Vignette */
    radial-gradient(
      120% 100% at 50% 45%,
      rgba(0,0,0,0) 0%,
      rgba(0,0,0,0) 42%,
      rgba(0,0,0, calc(var(--vignette-strength, .58) * .42)) 68%,
      rgba(0,0,0, var(--vignette-strength, .58)) 100%
    ),
    /* Your background image */
    var(--chat-bg-image) center / cover no-repeat,
    /* Fallback */
    linear-gradient(#0c0c0c,#070707);

  background-color: var(--chat-bg-color, #070707);

  position: relative;
  isolation: isolate;

  /* Calculate chat block width (col + 2*gutter) */
  --chat-block-w: min(100vw, calc(var(--col) + (var(--gutter) * 2)));
  --side-w: max(0px, calc((100vw - var(--chat-block-w)) / 2));
}

/* LEFT side blur panel */
#valki-root .valki-modal::before{
  content:"";
  position:absolute;
  top:0;
  bottom:0;
  left:0;
  width: var(--side-w);
  z-index:1;
  pointer-events:none;

  background: rgba(0,0,0,.18); /* transparant maar definieert de blur-zone */
  backdrop-filter: blur(var(--side-blur, 18px)) saturate(115%);
  -webkit-backdrop-filter: blur(var(--side-blur, 18px)) saturate(115%);

  box-shadow: inset -1px 0 rgba(255,255,255,.06);
}

/* RIGHT side blur panel */
#valki-root .valki-modal::after{
  content:"";
  position:absolute;
  top:0;
  bottom:0;
  right:0;
  width: var(--side-w);
  z-index:1;
  pointer-events:none;

  background: rgba(0,0,0,.18);
  backdrop-filter: blur(var(--side-blur, 18px)) saturate(115%);
  -webkit-backdrop-filter: blur(var(--side-blur, 18px)) saturate(115%);

  box-shadow: inset 1px 0 rgba(255,255,255,.06);
}

/* Keep real UI above blur panels */
#valki-root .valki-modal > *{
  position: relative;
  z-index: 2;
}

/* Mobile: disable side blur panels */
@media (max-width: 640px){
  #valki-root .valki-modal::before,
  #valki-root .valki-modal::after{
    display:none;
  }
}

/* Ensure actual UI sits above overlays */
#valki-root .valki-modal > *{
  position: relative;
  z-index: 2;
}

/* =========================================================
   Header — HARD column lock
========================================================= */
#valki-root .valki-modal-header{
  padding: calc(10px + env(safe-area-inset-top)) var(--gutter) 10px;
  border-bottom: 1px solid rgba(255,255,255,.08);

  /* Let block styling control background */
  background: transparent;
  backdrop-filter: none;
}

#valki-root .valki-modal-header-inner{
  max-width: var(--col) !important;
  width: 100% !important;
  margin: 0 auto !important;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

#valki-root .valki-header-left{ display:flex; align-items:center; gap: 10px; min-width:0; }

#valki-root .valki-agent-back{
  width:30px;height:30px;
  border-radius:50%;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  display:none;
  align-items:center;
  justify-content:center;
  color: rgba(255,255,255,.9);
}

#valki-root .valki-header-avatar{
  width:30px;height:30px;border-radius:50%;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.05);
  flex:0 0 auto;
}

#valki-root .valki-modal-title-text{ display:flex; flex-direction:column; min-width:0; }
#valki-root .valki-modal-title-text .name{
  font-size: 14px;
  font-weight: 720;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
#valki-root .valki-modal-title-text .session{
  font-size: 11px;
  color: var(--muted-2);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

#valki-root .valki-header-actions{ display:flex; align-items:center; gap: 8px; }

#valki-root .valki-pill{
  padding: 7px 10px;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.10);
  font-size: 12px;
  color: rgba(255,255,255,.86);
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
}
#valki-root .valki-pill:hover{
  transform: translateY(-1px);
  background: rgba(255,255,255,.06);
  border-color: rgba(255,255,255,.16);
}
#valki-root .valki-pill.primary{
  background: #f2f2f2;
  border-color: rgba(255,255,255,.20);
  color: #101010;
}
#valki-root .valki-close-btn{
  width:30px;height:30px;
  border-radius:50%;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  display:flex;align-items:center;justify-content:center;
}

/* =========================================================
   Agent Hub (WhatsApp-like list)
========================================================= */
#valki-root .valki-agent-hub{
  display:none;
  flex-direction:column;
  min-height:0;
  flex:1 1 auto;
  background: var(--chat-block-bg);
  backdrop-filter: blur(var(--chat-block-blur));
  -webkit-backdrop-filter: blur(var(--chat-block-blur));
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 16px;
  overflow: hidden;
}

#valki-root .valki-agent-hub-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: calc(14px + env(safe-area-inset-top)) var(--gutter) 14px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  gap: 12px;
}

#valki-root .valki-agent-hub-title{
  font-size: 18px;
  font-weight: 720;
}

#valki-root .valki-agent-hub-subtitle{
  font-size: 12px;
  color: var(--muted-2);
  margin-top: 2px;
}

#valki-root .valki-agent-list{
  flex:1 1 auto;
  overflow-y:auto;
  padding-bottom: env(safe-area-inset-bottom);
}

#valki-root .valki-agent-row{
  width: 100%;
  display:flex;
  align-items:center;
  gap: 12px;
  padding: 14px var(--gutter);
  position: relative;
  text-align:left;
  transition: background .16s ease;
}

#valki-root .valki-agent-row::after{
  content:"";
  position:absolute;
  left:0;
  right:0;
  bottom:0;
  height:1px;
  background: rgba(255,255,255,.06);
  pointer-events:none;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 18%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 18%);
}

#valki-root .valki-agent-row:hover{
  background: rgba(255,255,255,.04);
}

#valki-root .valki-agent-row.is-active{
  background: rgba(241,90,36,.16);
  border-left: 3px solid var(--brand);
  padding-left: calc(var(--gutter) - 3px);
}

@media (max-width: 1023px){
  #valki-root .valki-agent-row:active,
  #valki-root .valki-agent-row.is-active,
  #valki-root .valki-agent-row[data-selected="true"]{
    background: transparent;
    border-left: 2px solid var(--brand);
    padding-left: calc(var(--gutter) - 2px);
    position: relative;
    z-index: 1;
  }
}

#valki-root .valki-agent-avatar-wrap{
  position:relative;
  width:48px;
  height:48px;
  flex:0 0 auto;
}

#valki-root .valki-agent-avatar{
  width:48px;
  height:48px;
  border-radius:50%;
  border: 1px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.05);
}

#valki-root .valki-agent-status{
  position:absolute;
  right: 2px;
  bottom: 2px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid rgba(8,8,8,.9);
}

#valki-root .valki-agent-status.online{ background: #22c55e; }
#valki-root .valki-agent-status.away{ background: #f59e0b; }
#valki-root .valki-agent-status.busy{ background: #ef4444; }
#valki-root .valki-agent-status.offline{ background: rgba(255,255,255,.4); }

#valki-root .valki-agent-content{
  flex:1 1 auto;
  min-width:0;
  display:flex;
  flex-direction:column;
  gap: 4px;
}

#valki-root .valki-agent-name{
  font-size: 15px;
  font-weight: 650;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

#valki-root .valki-agent-desc{
  font-size: 12px;
  color: var(--muted);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

#valki-root .valki-agent-meta{
  font-size: 11px;
  color: var(--muted-2);
  text-transform: capitalize;
}

#valki-root .valki-agent-empty{
  display:none;
  padding: 24px var(--gutter);
  color: var(--muted);
  font-size: 13px;
}

#valki-root #valki-overlay[data-view="agent-hub"] .valki-modal-header,
#valki-root #valki-overlay[data-view="agent-hub"] .valki-messages,
#valki-root #valki-overlay[data-view="agent-hub"] .valki-chat-form{
  display:none !important;
}

#valki-root #valki-overlay[data-view="agent-hub"]:not([data-layout="desktop"]) .valki-modal{
  display:flex;
}

#valki-root #valki-overlay[data-view="agent-hub"]:not([data-layout="desktop"]) .valki-sidebar{
  display:flex;
}

#valki-root #valki-overlay[data-view="agent-hub"] .valki-agent-hub{
  display:flex;
}

#valki-root #valki-overlay[data-view="chat"] .valki-agent-hub{
  display:none;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-chat-shell{
  position: relative;
  overflow: hidden;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-sidebar{
  display: flex;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-modal{
  display: flex;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-modal{
  box-shadow: none;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-agent-hub{
  border: none;
  border-radius: 0;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-sidebar,
#valki-root #valki-overlay[data-layout="mobile"] .valki-modal{
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transition: none;
  will-change: auto;
}

#valki-root #valki-overlay[data-layout="mobile"][data-view="agent-hub"] .valki-sidebar,
#valki-root #valki-overlay[data-layout="mobile"][data-view="agent-hub"] .valki-modal{
  transition: transform 0.28s ease;
  will-change: transform;
}

#valki-root #valki-overlay[data-layout="mobile"][data-view="chat"] .valki-sidebar,
#valki-root #valki-overlay[data-layout="mobile"][data-view="chat"] .valki-modal{
  transition: none;
  will-change: auto;
}

#valki-root #valki-overlay[data-layout="mobile"][data-view="agent-hub"] .valki-sidebar{
  transform: translateX(0%);
  pointer-events: auto;
}

#valki-root #valki-overlay[data-layout="mobile"][data-view="agent-hub"] .valki-modal{
  transform: translateX(100%);
  pointer-events: none;
}

#valki-root #valki-overlay[data-layout="mobile"][data-view="chat"] .valki-sidebar{
  pointer-events: none;
}

#valki-root #valki-overlay[data-layout="mobile"][data-view="chat"] .valki-modal{
  transform: none;
  pointer-events: auto;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-sidebar{
  z-index: 1;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-modal{
  z-index: 2;
}

@media (prefers-reduced-motion: reduce){
  #valki-root #valki-overlay[data-layout="mobile"] .valki-sidebar,
  #valki-root #valki-overlay[data-layout="mobile"] .valki-modal{
    transition: none;
  }
}

@media (min-width: 1024px){
  #valki-root #valki-overlay[data-layout="desktop"] .valki-chat-shell{
    flex-direction: row;
    width: min(1200px, 100%);
  }

  #valki-root #valki-overlay[data-layout="desktop"] .valki-sidebar{
    display: flex;
    flex: 0 0 clamp(320px, 28vw, 380px);
    max-width: clamp(320px, 28vw, 380px);
    padding-right: 16px;
  }

  #valki-root #valki-overlay[data-layout="desktop"] .valki-sidebar .valki-agent-hub{
    display: flex;
    border-radius: 16px;
  }

  #valki-root #valki-overlay[data-layout="desktop"] .valki-modal{
    flex: 1 1 auto;
    min-width: 0;
  }

  #valki-root #valki-overlay[data-layout="desktop"] .valki-panel-frame{
    background: var(--valki-panel-bg);
    border: 1px solid var(--valki-panel-frame-border);
    box-shadow: var(--valki-panel-frame-shadow);
  }

  #valki-root #valki-overlay[data-layout="desktop"] .valki-modal{
    border-radius: 16px;
    overflow: hidden;
  }

  #valki-root #valki-overlay[data-layout="desktop"] .valki-modal::before,
  #valki-root #valki-overlay[data-layout="desktop"] .valki-modal::after{
    display: none;
  }
}

/* =========================================================
   STRONG CHAT BLOCK (FINAL)
   - Makes header/messages/composer read like ONE block
========================================================= */
#valki-root .valki-modal > .valki-modal-header,
#valki-root .valki-modal > .valki-messages,
#valki-root .valki-modal > .valki-chat-form{
  background: var(--chat-block-bg);
  backdrop-filter: blur(var(--chat-block-blur));
  -webkit-backdrop-filter: blur(var(--chat-block-blur));

  border-left: 1px solid var(--chat-block-border);
  border-right: 1px solid var(--chat-block-border);
}

#valki-root .valki-modal > .valki-modal-header{
  border-top: 1px solid rgba(255,255,255,.12);
}

#valki-root .valki-modal > .valki-chat-form{
  border-bottom: 1px solid rgba(255,255,255,.12);
}

/* Small highlights for depth */
#valki-root .valki-modal > .valki-modal-header,
#valki-root .valki-modal > .valki-chat-form{
  position: relative;
}
#valki-root .valki-modal > .valki-modal-header::after{
  content:"";
  position:absolute;
  left:0; right:0; bottom:0;
  height:1px;
  background: rgba(255,255,255,.06);
  pointer-events:none;
}
#valki-root .valki-modal > .valki-chat-form::before{
  display: none;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-modal > .valki-modal-header{
  border-top-color: transparent;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-modal > .valki-chat-form{
  border-bottom-color: transparent;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-modal > .valki-modal-header::before{
  content:"";
  position:absolute;
  left:0; right:0; top:0;
  height:1px;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0),
    rgba(255,255,255,.12) 18%,
    rgba(255,255,255,.12) 82%,
    rgba(255,255,255,0)
  );
  pointer-events:none;
}

#valki-root #valki-overlay[data-layout="mobile"] .valki-modal > .valki-chat-form::after{
  content: none;
  display: none;
}

#valki-root .valki-messages,
#valki-root .valki-messages-inner{
  overflow-anchor: none;
}

/* =========================================================
   Messages — HARD column lock
========================================================= */
#valki-root .valki-messages{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  padding: 18px 0 12px;
  display: flex !important;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  width: 100% !important;
  scrollbar-width:thin;
  scrollbar-color: rgba(255,255,255,.22) transparent;
}

#valki-root .valki-messages::-webkit-scrollbar{ width: 8px; }
#valki-root .valki-messages::-webkit-scrollbar-track{ background: transparent; }
#valki-root .valki-messages::-webkit-scrollbar-thumb{
  background: rgba(255,255,255,.18);
  border-radius: 999px;
  border: 2px solid rgba(0,0,0,.55);
}
#valki-root .valki-messages::-webkit-scrollbar-thumb:hover{ background: rgba(255,255,255,.26); }

#valki-root .valki-messages-inner{
  max-width: var(--col) !important;
  width: 100% !important;
  margin: 0 auto !important;
  padding-left: var(--gutter) !important;
  padding-right: var(--gutter) !important;
  padding-bottom: 8px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

#valki-root .valki-messages-inner:empty{ min-height: 220px; }

#valki-root .valki-msg-row{
  display:flex;
  align-items: flex-start;
  width: 100%;
  max-width: var(--col);
  margin: 14px auto;
  gap: 10px;
  justify-content: flex-start;
}

#valki-root .valki-msg-row.user{
  justify-content: flex-end;
  padding-left: var(--valki-avatar-col, 28px);
}

#valki-root .valki-msg-row.bot{
  justify-content: flex-start;
}

#valki-root .valki-bot-avatar-wrap{
  flex:0 0 var(--valki-avatar-col, 28px);
  width: var(--valki-avatar-col, 28px);
  display:flex;
  align-items:flex-start;
  justify-content:center;
  margin-top: -4px;
}
#valki-root .valki-bot-avatar-spacer{
  flex:0 0 var(--valki-avatar-col, 28px);
  width: var(--valki-avatar-col, 28px);
}
#valki-root .valki-bot-avatar{
  width:22px;height:22px;border-radius:50%;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.05);
}

#valki-root .valki-msg-bubble{
  flex: 0 1 auto;
  max-width: 100%;
  padding: 10px 14px;
  position: relative;
  border-radius: var(--radius);
  line-height: 1.58;
  font-size: 15px;
  color: rgba(255,255,255,.92);
  background: transparent;
  word-wrap: break-word;
  user-select:text;
}

#valki-root .valki-msg-author{
  font-size: 11px;
  text-transform: none;
  letter-spacing: .02em;
  opacity: .65;
  margin-bottom: 6px;
}

#valki-root .valki-msg-row.user .valki-msg-author{
  color: rgba(0,0,0,.65);
}

#valki-root .valki-msg-row.bot .valki-msg-author{
  color: rgba(255,255,255,.65);
}

#valki-root .valki-msg-row.bot .valki-msg-bubble{
  flex: 1 1 auto;
  width: 100%;
  max-width: min(100%, 720px);
  background: rgba(255,255,255,.035);
  border: 1px solid rgba(255,255,255,.08);
}

#valki-root .valki-msg-row.bot .valki-msg-bubble::before{
  content:"";
  position: absolute;
  left: -6px;
  top: 14px;
  width: 12px;
  height: 12px;
  background: inherit;
  transform: rotate(45deg);
  border-radius: 2px;
}

#valki-root .valki-msg-row.user .valki-msg-bubble{
  max-width: 78%;
  background: #f1f1f1;
  border: 1px solid rgba(255,255,255,.20);
  color: #0b0b0b;
  box-shadow: 0 10px 28px rgba(0,0,0,.30);
}

#valki-root .valki-msg-bubble a{
  color: var(--brand-2);
  text-decoration:none;
  font-weight: 650;
}
#valki-root .valki-msg-bubble a:hover{ text-decoration:underline; }

#valki-root .valki-msg-bubble code{
  font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
  font-size: 13px;
  background: rgba(255,255,255,.08);
  padding: 1px 5px;
  border-radius: 6px;
}

#valki-root .valki-typing-bar{ display:inline-flex; align-items:center; gap: 8px; }
#valki-root .valki-typing-dots{ display:inline-flex; gap: 4px; }
#valki-root .valki-typing-dots span{
  width:6px;height:6px;border-radius:50%;
  background: rgba(255,255,255,.72);
  animation: valkiBounce 1.2s infinite ease-in-out;
}
#valki-root .valki-typing-dots span:nth-child(2){ animation-delay:.15s; }
#valki-root .valki-typing-dots span:nth-child(3){ animation-delay:.30s; }

@keyframes valkiBounce{
  0%,60%,100%{ transform:translateY(0); opacity:.45; }
  30%{ transform:translateY(-3px); opacity:1; }
}
#valki-root .valki-typing-label{ font-size:12px; color: var(--muted); }

/* =========================================================
   Composer — HARD column lock
========================================================= */
#valki-root .valki-chat-form{
  border-top: none;
  background: transparent;
  backdrop-filter: none;
  padding: 10px 0 calc(var(--valki-chat-pad-bottom) + var(--keyboard-bottom)) !important;
}

#valki-root .valki-chat-form-inner{
  max-width: var(--col) !important;
  width: 100% !important;
  margin: 0 auto !important;
  padding-left: var(--gutter) !important;
  padding-right: var(--gutter) !important;
}

#valki-root .valki-chat-composer{
  display:grid;
  grid-template-columns: auto minmax(0,1fr);
  align-items:center;
  gap: 12px;
}

#valki-root .valki-chat-inner{
  display:flex;
  align-items:center;
  gap: 10px;
  min-height: 52px;
  width: 100%;
  padding: 6px 10px 6px 16px;
  border-radius: 26px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 14px 40px rgba(0,0,0,.45);
  transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease;
}

#valki-root .valki-chat-inner:focus-within{
  background: rgba(255,255,255,.055);
  border-color: rgba(255,255,255,.22);
  box-shadow: 0 16px 46px rgba(0,0,0,.5), 0 0 0 3px var(--ring);
}

#valki-root .valki-chat-attach{
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex: 0 0 auto;
  display:flex;
  align-items:center;
  justify-content:center;
  color: rgba(255,255,255,.86);
  transition: transform .12s ease, filter .12s ease, opacity .12s ease;
}
#valki-root .valki-chat-attach::before{
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 10px 24px rgba(0,0,0,.28);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  transition: background .12s ease, border-color .12s ease, box-shadow .12s ease;
}
#valki-root .valki-chat-attach svg{
  position: relative;
  z-index: 1;
}
#valki-root .valki-chat-attach:hover{
  transform: translateY(-1px);
  filter: brightness(1.04);
}
#valki-root .valki-chat-attach:hover::before{
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.2);
  box-shadow: 0 12px 28px rgba(0,0,0,.32);
}
#valki-root .valki-chat-attach:active{
  transform: translateY(0);
  filter: brightness(.98);
}
#valki-root .valki-chat-attach[disabled]{ opacity:.55; pointer-events:none; }
#valki-root .valki-chat-attach:focus-visible{
  outline: none;
  box-shadow: 0 0 0 3px var(--ring);
}

#valki-root .valki-chat-input{
  flex: 1 1 auto;
  min-width: 0;
  padding: 12px 8px 12px 0;
  border:none;
  background: transparent;
  color: rgba(255,255,255,.92);
  font-size: 16px;
  line-height: 24px;
  text-rendering: auto;
  display: block;
  width: 100%;
  min-height: 24px;
  max-height: calc(24px * 6 + 24px);
  resize:none;
  overflow-y:hidden;
  white-space: pre-wrap;
  word-break: break-word;
  caret-color: rgba(255,255,255,.86);
}
#valki-root .valki-chat-input::placeholder{ color: rgba(255,255,255,.36); }

#valki-root .valki-chat-send{
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--btn-fill);
  color: var(--btn-text);
  border: 1px solid rgba(255,255,255,.18);
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow: 0 10px 24px rgba(0,0,0,.32);
  transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease, filter .12s ease;
}
#valki-root .valki-chat-send:hover{
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(0,0,0,.38);
}
#valki-root .valki-chat-send:active{
  transform: translateY(0);
  filter: brightness(.96);
}
#valki-root .valki-chat-send[disabled]{ opacity:.55; pointer-events:none; }
#valki-root .valki-chat-send:focus-visible{
  outline: none;
  box-shadow: 0 0 0 3px var(--ring), 0 12px 28px rgba(0,0,0,.4);
}

/* Attachments tray */
#valki-root .valki-attachments{
  max-width: var(--col) !important;
  margin: 10px auto 0;
  padding-left: var(--gutter) !important;
  padding-right: var(--gutter) !important;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* ✅ Attachments thumbnails (was missing -> "buggy" feel) */
#valki-root .valki-attachment{
  position: relative;
  width: 58px;
  height: 58px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  box-shadow: 0 10px 26px rgba(0,0,0,.35);
}

#valki-root .valki-attachment img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

#valki-root .valki-attachment-remove{
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(0,0,0,.55);
  border: 1px solid rgba(255,255,255,.18);
  color: rgba(255,255,255,.92);
  display:flex;
  align-items:center;
  justify-content:center;
  line-height: 1;
}

/* =========================================================
   Extra blur + “blok” feel voor composer (vooral mobiel)
========================================================= */

/* Composer background (het hele onderste blok) */
#valki-root .valki-chat-form{
  background: rgba(8,8,8,.32); /* iets donkerder zodat blur beter leest */
  backdrop-filter: blur(20px) saturate(125%);
  -webkit-backdrop-filter: blur(20px) saturate(125%);
}

/* De pill zelf (verzendbalk / input container) */
#valki-root .valki-chat-inner{
  background: rgba(12,12,12,.40);
  backdrop-filter: blur(22px) saturate(130%);
  -webkit-backdrop-filter: blur(22px) saturate(130%);

  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 14px 40px rgba(0,0,0,.45);
}

/* Mobile: blur extra boosten + iets meer tint (werkt beter op iOS/Android) */
@media (max-width: 640px){
  #valki-root .valki-chat-form{
    background: rgba(0,0,0,.38);
    backdrop-filter: blur(24px) saturate(130%);
    -webkit-backdrop-filter: blur(24px) saturate(130%);
  }

  #valki-root .valki-chat-inner{
    min-height: 50px;
    background: rgba(10,10,10,.46);
    backdrop-filter: blur(26px) saturate(135%);
    -webkit-backdrop-filter: blur(26px) saturate(135%);
  }

  /* Mobile: ChatGPT-like caret baseline + prevent iOS caret misalignment */
  #valki-root .valki-chat-input{
    flex: 1 1 auto;
    min-width: 0;
    padding: 10px 8px 10px 0;
    box-sizing: border-box;
    font: inherit;
    border: none;
    background: transparent;
    color: rgba(255,255,255,.92);
    font-size: 16px;
    line-height: 24px;
    resize: none;
    overflow-y: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    caret-color: rgba(255,255,255,.86);
    -webkit-appearance: none;
    appearance: none;
  }
}

/* Fallback als backdrop-filter niet supported is (B2B-proof) */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  #valki-root .valki-chat-form{
    background: rgba(0,0,0,.62);
  }
  #valki-root .valki-chat-inner{
    background: rgba(12,12,12,.72);
  }
}

/* =========================================================
   Composer + disclaimer = één glass block
========================================================= */

/* Disclaimer onderdeel maken van de glass look */
#valki-root .valki-disclaimer{
  margin-top: 8px;
  padding: 6px 12px 0;
  color: rgba(255,255,255,.62);

  border-top: none;

  /* zelf geen blur nodig — valt visueel binnen de parent */
  background: transparent;
}

/* Cookie button iets cleaner/glassy */
#valki-root .valki-disclaimer-button{
  background: transparent;
  border: none;
  color: rgba(255,255,255,.70);
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}

#valki-root .valki-disclaimer-button:hover{
  color: rgba(255,255,255,.85);
}

/* Mobile: disclaimer sterker integreren in blur-blok */
@media (max-width: 640px){
  #valki-root .valki-disclaimer{
    margin-top: 10px;
    padding-top: 10px;
    border-top: none;
    color: rgba(255,255,255,.70);
  }
}

/* Disclaimer */
#valki-root .valki-disclaimer{
  max-width: var(--col) !important;
  margin: 6px auto 0 !important;
  padding-left: var(--gutter) !important;
  padding-right: var(--gutter) !important;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(255,255,255,.55);
  text-align:center;
}

/* Keep a small buffer so the last message sits above the composer */
html.valki-chat-open #valki-root .valki-messages{
  scroll-padding-bottom: 8px;
}

/* Mobile tweaks + disable vignette/blur */
@media (max-width:640px){
  #valki-root{
    --gutter: 14px;
    --col: 720px;
  }

  #valki-root .valki-modal{
    box-shadow: none;
  }

  #valki-root .valki-modal::before,
  #valki-root .valki-modal::after{
    display:none;
  }

  #valki-root .valki-modal > .valki-modal-header,
  #valki-root .valki-modal > .valki-messages,
  #valki-root .valki-modal > .valki-chat-form{
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-left: none;
    border-right: none;
  }

  #valki-root .valki-chat-attach{ width: 44px; height: 44px; }
  #valki-root .valki-chat-send{ width: 44px; height: 44px; }
  #valki-root .valki-bubble{
    right: 14px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    width: 62px;
    height: 62px;
  }
}

/* =========================================================
   Message attachments
========================================================= */

#valki-root .valki-msg-attachments{
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

#valki-root .valki-msg-attachment{
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: #101010;
}

#valki-root .valki-msg-attachment img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* =========================================================
   Bot message bubble — subtle glass blur for readability
========================================================= */

#valki-root .valki-msg-row.bot .valki-msg-bubble{
  background: rgba(20,20,20,.42); /* iets transparant */
  border: 1px solid rgba(255,255,255,.10);

  backdrop-filter: blur(7px) saturate(120%);
  -webkit-backdrop-filter: blur(7px) saturate(120%);

  box-shadow:
    0 8px 28px rgba(0,0,0,.35),
    inset 0 1px rgba(255,255,255,.04);

  color: rgba(255,255,255,.94);
}

@media (max-width: 640px){
  #valki-root .valki-msg-row.bot .valki-msg-bubble{
    background: rgba(16,16,16,.52);
    backdrop-filter: blur(14px) saturate(125%);
    -webkit-backdrop-filter: blur(14px) saturate(125%);
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  #valki-root .valki-msg-row.bot .valki-msg-bubble{
    background: rgba(20,20,20,.75);
  }
}

/* Utility */
#valki-root .valki-hidden{ display:none !important; }
`;
