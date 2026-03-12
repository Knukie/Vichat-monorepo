import { formatUsd } from '../../utils/formatUsd.js';
import { toCanvasChartModel } from '../../utils/agentChartAdapter.js';
import { renderCanvasLineChart } from '../../utils/canvasLineChart.js';

const IQAI_BASE_URL = 'https://auth.valki.wiki';
const PRICE_CHART_RANGE = '1M';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function ipfsUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (/^ipfs:\/\//i.test(raw)) {
    const path = raw.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '');
    return `https://ipfs.io/ipfs/${path}`;
  }

  if (/^\/\/(?!\/)/.test(raw)) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;

  const locationOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const isIpfsGatewayPath = typeof window !== 'undefined'
    && window.location
    && /^\/(ipfs|ipns)\//i.test(window.location.pathname || '');

  if (/^\/(ipfs|ipns)\//i.test(raw)) {
    return `${locationOrigin || 'https://ipfs.io'}${raw}`;
  }

  if (/^[a-z0-9]{46,}(?:\/.*)?$/i.test(raw) || /^bafy[a-z0-9]+(?:\/.*)?$/i.test(raw)) {
    return `https://ipfs.io/ipfs/${raw}`;
  }

  const preferredBase = isIpfsGatewayPath
    ? locationOrigin
    : (typeof document !== 'undefined' ? document.baseURI : locationOrigin);

  try {
    return new URL(raw, preferredBase || locationOrigin || IQAI_BASE_URL).toString();
  } catch {
    return '';
  }
}

function formatNumber(value, max = 8) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value ?? '-';
  if (num === 0) return '0';
  if (Math.abs(num) < 0.0001) return num.toExponential(3);
  return num.toFixed(Math.min(max, 8));
}

function shortWords(value, maxWords = 9) {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ');
  if (words.length <= maxWords) return cleaned;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

async function fetchJSON(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error || payload?.message || text.slice(0, 250);
    throw new Error(`HTTP ${response.status}: ${message}`);
  }
  return payload ?? text;
}

function endpoint(baseUrl, path, params) {
  const qs = params.toString();
  return `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
}

export function createIqaiExplorerController(elements, options = {}) {
  const baseUrl = String(options.baseUrl || IQAI_BASE_URL).replace(/\/$/, '');
  let allAgents = [];
  let byId = new Map();
  let byTicker = new Map();
  let byTokenContract = new Map();
  let initialized = false;
  let searchTimer = null;
  let selectedTicker = '';
  let chartRequestSeq = 0;
  const hasChartUi = Boolean(
    elements.priceChartPanel
    && elements.priceChartCanvas
    && elements.priceChartState
    && elements.priceChartTitle
  );

  const setStatus = (type, value, ok = true) => {
    const index = { agents: 0, metrics: 1, prices: 2, trades: 3 }[type];
    const pills = elements.statusLine.querySelectorAll('.valki-iqai-pill');
    const pill = pills[index];
    if (!pill) return;
    pill.textContent = value;
    pill.style.color = ok ? 'rgba(255,255,255,0.6)' : '#ffb3b3';
    pill.style.borderColor = ok ? 'rgba(255,255,255,.08)' : 'rgba(239,68,68,.45)';
  };

  const closeDrawer = () => {
    elements.drawerOverlay.style.display = 'none';
  };

  const openDrawer = (agent) => {
    elements.drawerTitle.textContent = `${agent.name} (${agent.ticker})`;
    elements.drawerSub.textContent = `Category: ${agent.category ?? '-'} • Framework: ${agent.framework ?? '-'} • Active: ${agent.isActive ? 'yes' : 'no'} • Verified: ${agent.isVerified ? 'yes' : 'no'}`;
    elements.drawerBio.textContent = agent.bio || '';

    const socials = Array.isArray(agent.socials) ? agent.socials : [];
    elements.drawerLinks.innerHTML = socials.length
      ? socials.map((social) => `<div style="margin-bottom:10px"><a href="${esc(social.url)}" target="_blank" rel="noopener noreferrer">${esc(social.name)}</a><div class="muted" style="margin-top:4px">${esc(social.url)}</div></div>`).join('')
      : '<span class="muted">Geen socials</span>';

    const contracts = {
      governanceContract: agent.governanceContract,
      tokenContract: agent.tokenContract,
      managerContract: agent.managerContract,
      poolContract: agent.poolContract,
      agentContract: agent.agentContract,
      creatorId: agent.creatorId,
      chainId: agent.chainId
    };

    elements.drawerContracts.innerHTML = Object.entries(contracts)
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([key, value]) => `<div><span class="muted">${key}:</span><br>${esc(value)}</div><div style="height:10px"></div>`)
      .join('') || '<span class="muted">Geen contract data</span>';

    const stats = {
      holdersCount: agent.holdersCount,
      inferenceCount: agent.inferenceCount,
      currentPriceInUSD: formatUsd(agent.currentPriceInUSD),
      currentPriceInIq: agent.currentPriceInIq,
      volumeAllTime: agent.volumeAllTime,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      tokenUri: agent.tokenUri
    };

    elements.drawerStats.innerHTML = Object.entries(stats)
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([key, value]) => `<div><span class="muted">${key}:</span> ${esc(String(value))}</div>`)
      .join('') || '<span class="muted">Geen stats</span>';

    elements.drawerOverlay.style.display = 'flex';
  };

  const setChartPanel = ({ visible, state = '', message = '', ticker = '' }) => {
    if (!hasChartUi) return;
    elements.priceChartPanel.hidden = !visible;
    elements.priceChartCanvas.hidden = state !== 'chart';
    elements.priceChartState.hidden = state === 'chart';
    if (state !== 'chart') {
      elements.priceChartState.className = state === 'error' ? 'valki-iqai-chart-state err' : 'valki-iqai-chart-state muted';
      elements.priceChartState.textContent = message;
    }
    elements.priceChartTitle.textContent = ticker ? `${ticker} chart (${PRICE_CHART_RANGE})` : 'Agent chart';
  };

  const syncSelectedPriceRow = () => {
    elements.pricesTableBody.querySelectorAll('tr[data-ticker]').forEach((row) => {
      const rowTicker = String(row.getAttribute('data-ticker') || '').toUpperCase();
      row.classList.toggle('is-active', Boolean(selectedTicker) && rowTicker === selectedTicker);
    });
  };

  const loadPriceChart = async (ticker) => {
    if (!hasChartUi) return;
    const requestSeq = ++chartRequestSeq;
    setChartPanel({ visible: true, state: 'loading', message: 'Chart laden...', ticker });

    try {
      const data = await fetchJSON(endpoint(baseUrl, `/api/iqai/agents/${encodeURIComponent(ticker)}/chart`, new URLSearchParams({ range: PRICE_CHART_RANGE })));
      if (requestSeq !== chartRequestSeq) return;

      const model = toCanvasChartModel(data);
      if (!model.series.length) {
        setChartPanel({ visible: true, state: 'empty', message: 'Geen chart data beschikbaar', ticker });
        return;
      }

      setChartPanel({ visible: true, state: 'chart', ticker: model.ticker || ticker });
      renderCanvasLineChart(elements.priceChartCanvas, model.series);
    } catch (error) {
      if (requestSeq !== chartRequestSeq) return;
      setChartPanel({ visible: true, state: 'error', message: `Chart ophalen mislukt: ${error.message}`, ticker });
    }
  };

  const renderPricesTable = (rows) => {
    if (!rows.length) {
      elements.pricesTableBody.innerHTML = '<tr><td colspan="4" class="muted">Geen data</td></tr>';
      selectedTicker = '';
      setChartPanel({ visible: false });
      return;
    }

    elements.pricesTableBody.innerHTML = rows.map((row) => {
      const ticker = String(row.ticker || row.symbol || '').toUpperCase();
      return `<tr data-ticker="${esc(ticker)}" class="valki-iqai-price-row"><td><strong>${esc(ticker || '-')}</strong></td><td>${esc(row.name || byTicker.get(ticker)?.name || '-')}</td><td class="right">${esc(formatUsd(row.currentPriceInUSD ?? row.priceUsd ?? row.usd ?? row.priceUSD))}</td><td class="right">${esc(formatNumber(row.currentPriceInIq ?? row.priceIq ?? row.iq, 10))}</td></tr>`;
    }).join('');

    syncSelectedPriceRow();
  };

  const togglePriceChart = (ticker) => {
    if (!hasChartUi) return;
    const nextTicker = String(ticker || '').toUpperCase();
    if (!nextTicker) return;

    if (selectedTicker === nextTicker) {
      selectedTicker = '';
      chartRequestSeq += 1;
      setChartPanel({ visible: false });
      syncSelectedPriceRow();
      return;
    }

    selectedTicker = nextTicker;
    syncSelectedPriceRow();
    void loadPriceChart(nextTicker);
  };

  const renderAgents = () => {
    const query = elements.search.value.trim().toLowerCase();
    const list = allAgents.filter((agent) => {
      if (!query) return true;
      return String(agent.name || '').toLowerCase().includes(query) || String(agent.ticker || '').toLowerCase().includes(query);
    });

    const debugAvatarUrls = [];
    elements.grid.innerHTML = list.map((agent) => {
      const avatar = ipfsUrl(agent.avatar || agent.avatarUrl || agent.image);
      if (avatar && debugAvatarUrls.length < 2) debugAvatarUrls.push({ id: agent.id, avatar });
      const price = formatUsd(agent.currentPriceInUSD);
      const kicker = `${agent.category || 'Agent'} • ${agent.isVerified ? 'Verified' : 'Unverified'} • ${agent.isActive ? 'Active' : 'Inactive'}`;
      const avatarFallbackText = String(agent.name || agent.ticker || '?').trim().charAt(0).toUpperCase() || '?';
      const avatarMarkup = `<div class="valki-iqai-avatar${avatar ? '' : ' is-fallback'}"><span class="valki-iqai-avatar-fallback" aria-hidden="true">${esc(avatarFallbackText)}</span>${avatar ? `<img src="${esc(avatar)}" alt="${esc(`${agent.name || 'Agent'} avatar`)}" loading="lazy" decoding="async">` : ''}</div>`;
      return `<article class="valki-iqai-card"><div class="valki-iqai-kicker">${esc(kicker.toUpperCase())}</div><div class="valki-iqai-head">${avatarMarkup}<div style="min-width:0;flex:1"><h3 class="valki-iqai-title">${esc(agent.name)}</h3><div class="valki-iqai-ticker">${esc(agent.ticker || '-')}</div><div class="valki-iqai-tags"><span class="valki-iqai-tag">${esc(agent.framework ?? '-')}</span><span class="valki-iqai-tag">Chain ${esc(agent.chainId ?? '-')}</span></div></div></div><div class="valki-iqai-bio">${esc(shortWords(agent.bio, 9))}</div><div class="valki-iqai-stats"><div>Holders: <strong>${esc(agent.holdersCount ?? '-')}</strong></div><div>Inference: <strong>${esc(agent.inferenceCount ?? '-')}</strong></div><div>Status: <strong>${agent.isActive ? 'Live' : 'Offline'}</strong></div><div>Verified: <strong>${agent.isVerified ? 'Yes' : 'No'}</strong></div></div><div class="valki-iqai-price">${price}</div><div class="valki-iqai-actions"><button class="valki-iqai-btn" data-open="${esc(agent.id)}" type="button">Open signal</button></div></article>`;
    }).join('');

    if (debugAvatarUrls.length) {
      console.debug('[IQAI Explorer] avatar URL samples', debugAvatarUrls);
    }

    elements.grid.querySelectorAll('.valki-iqai-avatar img').forEach((img) => {
      const container = img.closest('.valki-iqai-avatar');
      if (!container) return;
      img.addEventListener('load', () => {
        container.classList.add('is-loaded');
      }, { once: true });
      img.addEventListener('error', () => {
        img.style.display = 'none';
        img.setAttribute('alt', '');
        container.classList.remove('is-loaded');
        container.classList.add('is-fallback');
      }, { once: true });
    });

    elements.grid.querySelectorAll('[data-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-open') || '';
        const agent = byId.get(id);
        if (agent) openDrawer(agent);
      });
    });

    setStatus('agents', `Agents: ${list.length}`);
    elements.heroSub.textContent = `${list.length} signals in view…`;
  };

  const loadAgents = async () => {
    setStatus('agents', 'Agents: laden…');
    const params = new URLSearchParams();
    params.set('sort', 'latest');
    params.set('order', elements.order.value || 'asc');
    if (elements.status.value) params.set('status', elements.status.value);
    const data = await fetchJSON(endpoint(baseUrl, '/api/iqai/agents', params));
    allAgents = Array.isArray(data.agents) ? data.agents : [];
    byId = new Map(allAgents.map((agent) => [agent.id, agent]));
    byTicker = new Map(allAgents.map((agent) => [String(agent.ticker || '').toUpperCase(), agent]));
    byTokenContract = new Map(allAgents.map((agent) => [String(agent.tokenContract || '').toLowerCase(), agent]));
    renderAgents();
  };

  const renderMetricsTable = (items) => {
    elements.metricsTableBody.innerHTML = items.map((row, idx) => {
      const agentId = row.agentId || row.id || row.agent_id;
      const details = row.agentDetails || row.agent || byId.get(agentId) || byTicker.get(String(row.ticker || '').toUpperCase());
      const countVal = typeof row.count === 'number' ? row.count : row.count?.count ?? row.trades ?? row.tradeCount ?? '-';
      return `<tr><td>${idx + 1}</td><td>${esc(details?.name || row.name || agentId || '-')}</td><td>${esc(details?.ticker || row.ticker || '-')}</td><td class="right"><strong>${esc(countVal)}</strong></td><td class="right">${esc(details?.isActive == null ? '-' : details.isActive ? 'yes' : 'no')}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="muted">Geen data</td></tr>';
  };

  const loadMetrics = async () => {
    setStatus('metrics', 'Metrics: laden…');
    try {
      const data = await fetchJSON(endpoint(baseUrl, '/api/iqai/api/metrics', new URLSearchParams({ view: elements.metricsView.value || 'mostTraded7d' })));
      const items = Array.isArray(data.tradeCount) ? data.tradeCount : Array.isArray(data.items) ? data.items : Array.isArray(data.data) ? data.data : [];
      renderMetricsTable(items);
      elements.metricsHint.textContent = `Loaded view=${elements.metricsView.value}`;
      setStatus('metrics', 'Metrics: ok');
    } catch (error) {
      setStatus('metrics', 'Metrics: error', false);
      elements.metricsTableBody.innerHTML = `<tr><td colspan="5" class="err">${esc(error.message)}</td></tr>`;
    }
  };

  const loadPrices = async () => {
    setStatus('prices', 'Prices: laden…');
    try {
      const data = await fetchJSON(endpoint(baseUrl, '/api/iqai/api/prices', new URLSearchParams()));
      let rows = Array.isArray(data) ? data : Array.isArray(data.prices) ? data.prices : Array.isArray(data.items) ? data.items : [];
      if (!rows.length && allAgents.length) {
        rows = allAgents.map((agent) => ({ ticker: agent.ticker, name: agent.name, currentPriceInUSD: agent.currentPriceInUSD, currentPriceInIq: agent.currentPriceInIq }));
      }
      renderPricesTable(rows);
      if (selectedTicker) {
        const tickerStillExists = rows.some((row) => String(row.ticker || row.symbol || '').toUpperCase() === selectedTicker);
        if (tickerStillExists) {
          void loadPriceChart(selectedTicker);
        } else {
          selectedTicker = '';
          chartRequestSeq += 1;
          setChartPanel({ visible: false });
          syncSelectedPriceRow();
        }
      }
      setStatus('prices', 'Prices: ok');
    } catch (error) {
      setStatus('prices', 'Prices: error', false);
      elements.pricesTableBody.innerHTML = `<tr><td colspan="4" class="err">${esc(error.message)}</td></tr>`;
      setChartPanel({ visible: true, state: 'error', message: `Chart ophalen mislukt: ${error.message}`, ticker: selectedTicker });
    }
  };

  const loadTx = async () => {
    setStatus('trades', 'Trades: laden…');
    try {
      const data = await fetchJSON(endpoint(baseUrl, '/api/iqai/api/transactions', new URLSearchParams({ limit: elements.txLimit.value || '10' })));
      const rows = Array.isArray(data) ? data : Array.isArray(data.transactions) ? data.transactions : Array.isArray(data.items) ? data.items : Array.isArray(data.data) ? data.data : [];
      elements.txTableBody.innerHTML = rows.map((row) => {
        const ts = row.timestamp || row.createdAt || row.time || row.date || '';
        const time = ts ? esc(String(ts).slice(0, 19).replace('T', ' ')) : '-';
        const agentId = row.agentId || row.agent_id || row.agent || '';
        const token = String(row.tokenContract || row.token || '').toLowerCase();
        const ticker = row.ticker || byId.get(agentId)?.ticker || byTokenContract.get(token)?.ticker || '-';
        const name = byId.get(agentId)?.name || byTokenContract.get(token)?.name || row.agentName || '-';
        const txHash = row.txHash || row.transactionHash || row.hash || '';
        const txLink = txHash ? `<a href="${esc(txHash)}" target="_blank" rel="noopener noreferrer">link</a>` : '-';
        return `<tr><td>${time}</td><td>${esc(name)} <span class="muted">(${esc(ticker)})</span></td><td class="right">${esc(row.type || row.side || row.action || row.event || '-')}</td><td class="right">${esc(formatNumber(row.amount || row.size || row.qty || row.tokens || '-', 6))}</td><td class="right">${esc(formatUsd(row.usdValue || row.valueUsd || row.usd || row.valueUSD))}</td><td>${txLink}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="muted">Geen data</td></tr>';
      setStatus('trades', 'Trades: ok');
    } catch (error) {
      setStatus('trades', 'Trades: error', false);
      elements.txTableBody.innerHTML = `<tr><td colspan="6" class="err">${esc(error.message)}</td></tr>`;
    }
  };

  const loadAll = async () => {
    try {
      await loadAgents();
    } catch (error) {
      setStatus('agents', 'Agents: error', false);
      elements.grid.innerHTML = `<div class="valki-iqai-card"><div class="err">${esc(error.message)}</div></div>`;
    }
    await Promise.all([loadMetrics(), loadPrices(), loadTx()]);
  };

  const setup = () => {
    if (initialized) return;
    initialized = true;
    elements.reload.addEventListener('click', loadAll);
    elements.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(renderAgents, 120);
    });
    elements.status.addEventListener('change', loadAgents);
    elements.order.addEventListener('change', loadAgents);
    elements.reloadMetrics.addEventListener('click', loadMetrics);
    elements.metricsView.addEventListener('change', loadMetrics);
    elements.reloadPrices.addEventListener('click', loadPrices);
    elements.pricesTableBody.addEventListener('click', (event) => {
      const row = event.target instanceof Element ? event.target.closest('tr[data-ticker]') : null;
      if (!row) return;
      togglePriceChart(row.getAttribute('data-ticker'));
    });
    if (elements.priceChartClose) {
      elements.priceChartClose.addEventListener('click', () => {
        selectedTicker = '';
        chartRequestSeq += 1;
        setChartPanel({ visible: false });
        syncSelectedPriceRow();
      });
    }
    elements.reloadTx.addEventListener('click', loadTx);
    elements.txLimit.addEventListener('change', loadTx);
    elements.drawerClose.addEventListener('click', closeDrawer);
    elements.drawerOverlay.addEventListener('click', (event) => {
      if (event.target === elements.drawerOverlay) closeDrawer();
    });
  };

  return {
    async activate() {
      setup();
      if (!allAgents.length) await loadAll();
    }
  };
}
