export function renderCanvasLineChart(canvas, values, options = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const parent = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  if (!ctx || !parent) return;

  const numericValues = Array.isArray(values) ? values.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [];
  if (!numericValues.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const width = Math.max(parent.clientWidth, 200);
  const height = Number(options.height) > 0 ? Number(options.height) : 240;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 18, right: 22, bottom: 24, left: 22 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const spread = max - min || max || 1;
  const trendUp = numericValues[numericValues.length - 1] >= numericValues[0];
  const trendColor = trendUp ? '#32d583' : '#f97066';

  const points = numericValues.map((value, i) => {
    const x = pad.left + (i / Math.max(numericValues.length - 1, 1)) * chartW;
    const y = pad.top + ((max - value) / spread) * chartH;
    return { x, y };
  });

  drawGrid(ctx, height, pad, chartW, chartH);

  ctx.beginPath();
  points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else {
      const prev = points[i - 1];
      const xc = (prev.x + point.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, xc, (prev.y + point.y) / 2);
    }
  });
  const lastPoint = points[points.length - 1];
  ctx.lineTo(lastPoint.x, lastPoint.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = trendColor;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  points.forEach((point, i) => (i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  gradient.addColorStop(0, `${trendColor}66`);
  gradient.addColorStop(1, `${trendColor}00`);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function drawGrid(ctx, height, pad, chartW, chartH) {
  ctx.strokeStyle = 'rgba(149, 163, 190, 0.15)';
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

  ctx.strokeStyle = 'rgba(149, 163, 190, 0.3)';
  ctx.strokeRect(pad.left, pad.top, chartW, chartH);
}
