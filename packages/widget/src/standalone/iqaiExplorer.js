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
    agentsSection: get('agents-section'),
    grid: get('agents-grid'),
    metricsView: get('metrics-view'),
    reloadMetrics: get('reload-metrics'),
    metricsHint: get('metrics-hint'),
    metricsTableBody: root.querySelector('[data-iqai-el="metrics-table"] tbody'),
    reloadPrices: get('reload-prices'),
    pricesTableBody: root.querySelector('[data-iqai-el="prices-table"] tbody'),
    priceChartPanel: get('price-chart-panel'),
    priceChartTitle: get('price-chart-title'),
    priceChartClose: get('price-chart-close'),
    priceChartState: get('price-chart-state'),
    priceChartCanvas: get('price-chart-canvas'),
    transactionsSection: get('transactions-section'),
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
  const config = {
    showAgents: true,
    showTransactions: true,
    ...options
  };
  const instance = {};
  const resolvedTarget = resolveTarget(config.target);
  if (!resolvedTarget) throw new Error('IQAIExplorer.mount: target not found');

  let target = null;
  let pendingMount = null;

  const startMount = () => {
    target = resolvedTarget;

    injectStyles();
    unmountTarget(target);
    target.classList.add('iqai-explorer-root');
    target.innerHTML = iqaiExplorerTemplate;

    const elements = mapElements(target);
    if (elements.agentsSection && !config.showAgents) elements.agentsSection.style.display = 'none';
    if (elements.transactionsSection && !config.showTransactions) elements.transactionsSection.style.display = 'none';

    const controller = createIqaiExplorerController(elements, {
      baseUrl: config.baseUrl,
      showAgents: config.showAgents,
      showTransactions: config.showTransactions
    });

    void controller.activate();
    mounts.set(target, { controller, instance });
  };

  if (document.readyState === 'loading' && typeof config.target === 'string') {
    pendingMount = () => {
      pendingMount = null;
      startMount();
    };
    document.addEventListener('DOMContentLoaded', pendingMount, { once: true });
  } else {
    startMount();
  }

  return {
    unmount() {
      if (pendingMount) {
        document.removeEventListener('DOMContentLoaded', pendingMount);
        pendingMount = null;
      }
      if (target) unmountTarget(target, instance);
    }
  };
}

const IQAIExplorer = { mount };
window.IQAIExplorer = IQAIExplorer;
