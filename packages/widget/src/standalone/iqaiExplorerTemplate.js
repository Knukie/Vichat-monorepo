export const iqaiExplorerTemplate = `
<section class="valki-iqai" aria-live="polite">
  <div class="valki-iqai-hero">
    <div class="valki-iqai-onair">
      <span class="valki-iqai-dot" aria-hidden="true"></span>
      <span class="valki-iqai-live">Live</span>
      <span class="valki-iqai-sub" data-iqai-el="hero-sub">Agent scan…</span>
    </div>
    <div class="valki-iqai-controls">
      <input data-iqai-el="q" placeholder="Zoek op naam of ticker…" />
    </div>
  </div>

  <section class="valki-iqai-grid" data-iqai-el="agents-section">
    <div data-iqai-el="agents-grid"></div>
  </section>

  <section class="valki-iqai-section">
    <div class="valki-iqai-section-top">
      <h2>Top traded agents</h2>
      <div class="valki-iqai-controls">
        <select data-iqai-el="metrics-view">
          <option value="mostTraded7d" selected>mostTraded7d</option>
          <option value="mostTraded24h">mostTraded24h</option>
          <option value="overall">overall</option>
        </select>
        <button class="valki-iqai-btn" data-iqai-el="reload-metrics" type="button">Reload metrics</button>
      </div>
    </div>
    <div class="valki-iqai-meta" data-iqai-el="metrics-hint">Loading…</div>
    <div class="valki-iqai-table-wrap">
      <table data-iqai-el="metrics-table">
        <thead><tr><th>#</th><th>Agent</th><th>Ticker</th><th class="right">Trades</th><th class="right">Active</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="valki-iqai-section">
    <div class="valki-iqai-section-top">
      <h2>Prices</h2>
      <div class="valki-iqai-controls">
        <button class="valki-iqai-btn" data-iqai-el="reload-prices" type="button">Reload prices</button>
      </div>
    </div>
    <div class="valki-iqai-table-wrap">
      <table id="valki-iqai-prices-table" data-iqai-el="prices-table">
        <thead><tr><th>Ticker</th><th>Name</th><th class="right">USD</th><th class="right">IQ</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="valki-iqai-chart-panel" data-iqai-el="price-chart-panel" hidden>
      <div class="valki-iqai-chart-top">
        <strong data-iqai-el="price-chart-title">Agent chart</strong>
        <button class="valki-iqai-btn" data-iqai-el="price-chart-close" type="button">Sluiten</button>
      </div>
      <div class="valki-iqai-chart-state muted" data-iqai-el="price-chart-state">Chart laden...</div>
      <canvas data-iqai-el="price-chart-canvas" class="valki-iqai-chart-canvas" aria-label="Agent prijs chart"></canvas>
    </div>
  </section>

  <section class="valki-iqai-section" data-iqai-el="transactions-section">
    <div class="valki-iqai-section-top">
      <h2>Recent transactions</h2>
      <div class="valki-iqai-controls">
        <select data-iqai-el="tx-limit">
          <option value="10" selected>10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
        <button class="valki-iqai-btn" data-iqai-el="reload-tx" type="button">Reload trades</button>
      </div>
    </div>
    <div class="valki-iqai-table-wrap">
      <table data-iqai-el="tx-table">
        <thead><tr><th>Tx</th><th>Time</th><th>Agent</th><th class="right">Type</th><th class="right">Amount</th><th class="right">USD</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <div class="valki-iqai-drawer-overlay" data-iqai-el="drawer-overlay">
    <div class="valki-iqai-drawer">
      <div class="valki-iqai-drawer-top">
        <div>
          <h3 data-iqai-el="drawer-title">Agent</h3>
          <div class="muted" data-iqai-el="drawer-sub"></div>
        </div>
        <button class="valki-iqai-btn" data-iqai-el="drawer-close" type="button">Sluiten</button>
      </div>
      <div class="valki-iqai-drawer-grid">
        <div class="valki-iqai-box"><h4>Bio</h4><div data-iqai-el="drawer-bio"></div><div class="divider"></div><h4>Socials</h4><div data-iqai-el="drawer-links"></div></div>
        <div class="valki-iqai-box"><h4>Contracts</h4><div class="mono" data-iqai-el="drawer-contracts"></div><div class="divider"></div><h4>Stats</h4><div class="mono" data-iqai-el="drawer-stats"></div></div>
      </div>
    </div>
  </div>
</section>`;
