const RANGES = ["5D", "1M", "3M", "6M", "1Y", "5Y"];
const DEFAULT_RANGE = "1M";

const els = {
  price: document.getElementById("price"),
  change: document.getElementById("change"),
  rangeButtons: document.getElementById("rangeButtons"),
  canvas: document.getElementById("valkiChart"),
  loadingState: document.getElementById("loadingState"),
  metaRange: document.getElementById("metaRange"),
  metaMinMax: document.getElementById("metaMinMax"),
  metaUpdated: document.getElementById("metaUpdated")
};

let currentRange = DEFAULT_RANGE;
let latestSnapshot = null;
let lastTrendUp = true;
let snapshotRequestSeq = 0;

const resizeObserver = new ResizeObserver(() => {
  if (latestSnapshot) renderChart(latestSnapshot.candles || []);
});
resizeObserver.observe(els.canvas.parentElement);

function fmtUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  }).format(Number(value) || 0);
}

function fmtPct(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtTime(ts) {
  const time = Number(ts);
  if (!Number.isFinite(time)) return "--";
  return new Date(time).toLocaleString();
}

function buildButtons() {
  els.rangeButtons.innerHTML = "";
  for (const range of RANGES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `range-btn ${range === currentRange ? "active" : ""}`;
    btn.textContent = range;
    btn.addEventListener("click", () => {
      if (range === currentRange) return;
      loadSnapshot(range);
    });
    els.rangeButtons.appendChild(btn);
  }
}

async function loadSnapshot(range = DEFAULT_RANGE) {
  currentRange = RANGES.includes(range) ? range : DEFAULT_RANGE;
  buildButtons();
  els.loadingState.hidden = false;
  const requestSeq = ++snapshotRequestSeq;

  try {
    const response = await fetch(`/api/valki/snapshot?range=${encodeURIComponent(currentRange)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (requestSeq !== snapshotRequestSeq) return;

    const candles = Array.isArray(data.candles) ? data.candles : [];
    const closes = candles.map((c) => Number(c.close)).filter((v) => Number.isFinite(v));
    const min = closes.length ? Math.min(...closes) : 0;
    const max = closes.length ? Math.max(...closes) : 0;

    latestSnapshot = {
      ...data,
      candles,
      series: closes,
      range: RANGES.includes(data.range) ? data.range : currentRange
    };

    const first = closes[0] ?? 0;
    const last = closes[closes.length - 1] ?? (Number(data.price) || 0);
    lastTrendUp = last >= first;

    els.price.textContent = fmtUsd(last);
    els.change.textContent = fmtPct(data.change24h);
    els.change.className = `change-badge ${data.change24h > 0 ? "up" : data.change24h < 0 ? "down" : "neutral"}`;

    els.metaRange.textContent = `Range: ${latestSnapshot.range}`;
    els.metaMinMax.textContent = `Min/Max: ${fmtUsd(min)} / ${fmtUsd(max)}`;
    els.metaUpdated.textContent = `Updated: ${fmtTime(data.updatedAt)}`;

    renderChart(candles);
  } catch (error) {
    if (requestSeq !== snapshotRequestSeq) return;
    els.metaUpdated.textContent = "Updated: failed to load snapshot";
    console.error("[VALKI] failed loading snapshot", error);
  } finally {
    if (requestSeq === snapshotRequestSeq) {
      els.loadingState.hidden = true;
    }
  }
}

function renderChart(candles) {
  const parent = els.canvas.parentElement;
  const ctx = els.canvas.getContext("2d");
  if (!ctx || !parent) return;

  const width = parent.clientWidth;
  const height = 320;
  const dpr = window.devicePixelRatio || 1;

  els.canvas.width = Math.round(width * dpr);
  els.canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);

  const values = candles.map((c) => Number(c.close)).filter((v) => Number.isFinite(v));
  if (!values.length) return;

  const pad = { top: 18, right: 22, bottom: 24, left: 22 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || max || 1;

  const points = values.map((value, i) => {
    const x = pad.left + (i / Math.max(values.length - 1, 1)) * chartW;
    const y = pad.top + ((max - value) / spread) * chartH;
    return { x, y, value };
  });

  drawGrid(ctx, width, height, pad, chartW, chartH);

  const trendColor = lastTrendUp ? "#32d583" : "#f97066";

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else {
      const prev = points[i - 1];
      const xc = (prev.x + p.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, xc, (prev.y + p.y) / 2);
    }
  });
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);

  ctx.lineWidth = 2;
  ctx.strokeStyle = trendColor;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  gradient.addColorStop(0, `${trendColor}66`);
  gradient.addColorStop(1, `${trendColor}00`);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  drawLastPriceMarker(ctx, last, trendColor, values[values.length - 1]);
}

function drawGrid(ctx, width, height, pad, chartW, chartH) {
  ctx.strokeStyle = "rgba(149, 163, 190, 0.15)";
  ctx.lineWidth = 1;

  for (let i = 0; i < 5; i += 1) {
    const y = pad.top + (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
  }

  for (let i = 0; i < 5; i += 1) {
    const x = pad.left + (i / 4) * chartW;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(149, 163, 190, 0.3)";
  ctx.strokeRect(pad.left, pad.top, chartW, chartH);
}

function drawLastPriceMarker(ctx, point, color, value) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
  ctx.fill();

  const label = fmtUsd(value);
  ctx.font = "12px Inter, system-ui, sans-serif";
  const textW = ctx.measureText(label).width;
  const labelW = textW + 12;
  const labelH = 24;
  const x = Math.min(point.x + 10, ctx.canvas.width / (window.devicePixelRatio || 1) - labelW - 6);
  const y = Math.max(point.y - labelH - 8, 8);

  ctx.fillStyle = "rgba(6, 10, 16, 0.9)";
  roundRect(ctx, x, y, labelW, labelH, 7);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, labelW, labelH, 7);
  ctx.stroke();

  ctx.fillStyle = "#f5f7ff";
  ctx.fillText(label, x + 6, y + 15);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

buildButtons();
loadSnapshot(DEFAULT_RANGE);
