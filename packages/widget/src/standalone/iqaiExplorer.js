import { createIqaiExplorerController } from '../core/ui/iqaiExplorer.js';
import { iqaiExplorerTemplate } from './iqaiExplorerTemplate.js';
import { iqaiExplorerCss } from './iqaiExplorerStyles.js';

const STYLE_ID = 'iqai-explorer-inline-style';
const mounts = new WeakMap();

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = iqaiExplorerCss;
  document.head.appendChild(style);
}

function resolveTarget(target) {
  if (typeof target === 'string') return document.querySelector(target);
  if (target instanceof Element) return target;
  return null;
}

function mapElements(root) {
  const get = (key) => root.querySelector(`[data-iqai-el="${key}"]`);
  return {
    root,
    search: get('q'),
    status: get('status'),
    order: get('order'),
    reload: get('reload'),
    statusLine: get('status-line'),
    heroSub: get('hero-sub'),
    grid: get('agents-grid'),
    metricsView: get('metrics-view'),
    reloadMetrics: get('reload-metrics'),
    metricsHint: get('metrics-hint'),
    metricsTableBody: root.querySelector('[data-iqai-el="metrics-table"] tbody'),
    reloadPrices: get('reload-prices'),
    pricesTableBody: root.querySelector('[data-iqai-el="prices-table"] tbody'),
    txLimit: get('tx-limit'),
    reloadTx: get('reload-tx'),
    txTableBody: root.querySelector('[data-iqai-el="tx-table"] tbody'),
    drawerOverlay: get('drawer-overlay'),
    drawerClose: get('drawer-close'),
    drawerTitle: get('drawer-title'),
    drawerSub: get('drawer-sub'),
    drawerBio: get('drawer-bio'),
    drawerLinks: get('drawer-links'),
    drawerContracts: get('drawer-contracts'),
    drawerStats: get('drawer-stats')
  };
}

function unmountTarget(target, instance) {
  const mounted = mounts.get(target);
  if (!mounted) return;
  if (instance && mounted.instance !== instance) return;

  if (mounted) {
    target.innerHTML = '';
    mounts.delete(target);
    target.classList.remove('iqai-explorer-root');
  }
}

function mount(options = {}) {
  const target = resolveTarget(options.target);
  if (!target) throw new Error('IQAIExplorer.mount: target not found');
  injectStyles();
  unmountTarget(target);
  target.classList.add('iqai-explorer-root');
  target.innerHTML = iqaiExplorerTemplate;
  const instance = {};

  const controller = createIqaiExplorerController(mapElements(target), {
    baseUrl: options.baseUrl
  });

  void controller.activate();
  mounts.set(target, { controller, instance });

  return {
    unmount() {
      unmountTarget(target, instance);
    }
  };
}

const IQAIExplorer = { mount };
window.IQAIExplorer = IQAIExplorer;

export { IQAIExplorer };
