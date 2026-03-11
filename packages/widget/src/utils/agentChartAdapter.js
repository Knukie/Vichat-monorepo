export function toCanvasChartModel(payload) {
  const points = Array.isArray(payload?.points) ? payload.points : [];
  const candles = Array.isArray(payload?.candles)
    ? payload.candles
    : points.map((point) => ({
        time: Number(point?.time),
        close: Number(point?.value),
        value: Number(point?.value)
      }));

  const normalizedCandles = candles
    .map((candle) => {
      const time = Number(candle?.time);
      const close = Number(candle?.close ?? candle?.value);
      if (!Number.isFinite(time) || !Number.isFinite(close)) return null;
      return { time, close, value: close };
    })
    .filter(Boolean);

  return {
    ticker: String(payload?.ticker || '').toUpperCase(),
    range: String(payload?.range || ''),
    updatedAt: Number(payload?.updatedAt) || Date.now(),
    candles: normalizedCandles,
    series: normalizedCandles.map((candle) => candle.close),
    points: points
      .map((point) => ({
        time: Number(point?.time),
        value: Number(point?.value)
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
  };
}
