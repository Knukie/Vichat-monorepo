// Generated from src/themes/widget-host.css
export const widgetHostCss = `/* =========================================================
   Widget Host — Shared layout shell for embedded widgets
========================================================= */
.widget-host{
  --widget-host-right: 16px;
  --widget-host-bottom: 16px;
  --widget-host-width: min(420px, calc(100vw - 32px));
  --widget-host-height: auto;
  --widget-host-max-width: 420px;
  --widget-host-max-height: 80vh;
  --widget-host-min-height: 320px;
  --widget-host-z: 2147482997;

  position: fixed;
  right: var(--widget-host-right);
  bottom: var(--widget-host-bottom);
  width: var(--widget-host-width);
  height: var(--widget-host-height);
  max-width: var(--widget-host-max-width);
  max-height: var(--widget-host-max-height);
  min-height: var(--widget-host-min-height);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  z-index: var(--widget-host-z);
  pointer-events: auto;
  isolation: isolate;
}

.widget-host,
.widget-host *{
  box-sizing: border-box;
}

.widget-host > *{
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

.widget-host[data-widget-placement="inline"]{
  position: relative;
  right: auto;
  bottom: auto;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  min-height: 0;
}

.widget-host[data-widget-type="panel"]{
  --widget-host-width: min(480px, calc(100vw - 32px));
  --widget-host-max-width: 480px;
}

.widget-host[data-widget-type="floating-bubble"]{
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  min-height: 0;
}

.widget-host iframe{
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

@media (max-width: 640px){
  .widget-host[data-widget-placement="floating"]{
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    max-height: 100dvh;
    min-height: 0;
  }
}
`;
