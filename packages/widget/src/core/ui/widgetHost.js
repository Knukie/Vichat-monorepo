const DEFAULT_HOST_CONFIG = {
  type: 'chat',
  provider: 'valki-vichat'
};

const resolvePlacement = (target, override) => {
  if (override) return override;
  if (target === document.body || target === document.documentElement) {
    return 'floating';
  }
  return 'inline';
};

const toCssSize = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  return String(value);
};

const applyCssVar = (el, name, value) => {
  const resolved = toCssSize(value);
  if (!resolved) return;
  el.style.setProperty(name, resolved);
};

export function createWidgetHost({ target, config = {} }) {
  const host = document.createElement('div');
  host.classList.add('widget-host');
  if (config.className) {
    config.className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((name) => host.classList.add(name));
  }

  const type = config.type || DEFAULT_HOST_CONFIG.type;
  const provider = config.provider || DEFAULT_HOST_CONFIG.provider;
  const placement = resolvePlacement(target, config.placement);

  host.dataset.widgetType = type;
  host.dataset.widgetProvider = provider;
  host.dataset.widgetPlacement = placement;
  host.dataset.widgetState = config.state || 'mounting';
  if (config.mode) host.dataset.widgetMode = config.mode;
  if (config.id) host.id = config.id;

  applyCssVar(host, '--widget-host-width', config.width || config.size?.width);
  applyCssVar(host, '--widget-host-height', config.height || config.size?.height);
  applyCssVar(host, '--widget-host-max-width', config.maxWidth || config.size?.maxWidth);
  applyCssVar(host, '--widget-host-max-height', config.maxHeight || config.size?.maxHeight);
  applyCssVar(host, '--widget-host-right', config.offsetX ?? config.right);
  applyCssVar(host, '--widget-host-bottom', config.offsetY ?? config.bottom);
  applyCssVar(host, '--widget-host-min-height', config.minHeight);

  target.appendChild(host);
  return host;
}
