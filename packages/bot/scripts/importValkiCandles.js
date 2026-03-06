import fs from "fs";
import path from "path";

const MAX_SERIES_POINTS = 200;
const DATA_PATH = path.resolve("packages/bot/data/valki-snapshot.json");

const candles = [
  // PASTE_CANDLE_JSON_ARRAY_HERE
];

const normalizedCandles = Array.isArray(candles)
  ? candles
      .map((candle) => ({
        time: Number(candle?.time),
        open: Number(candle?.open),
        high: Number(candle?.high),
        low: Number(candle?.low),
        close: Number(candle?.close)
      }))
      .filter(
        (candle) =>
          Number.isFinite(candle.time) &&
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close)
      )
  : [];

const series = normalizedCandles.map((c) => Number(c.close));
const trimmedSeries = series.length > MAX_SERIES_POINTS ? series.slice(-MAX_SERIES_POINTS) : series;

const snapshot = {
  price: trimmedSeries.length ? trimmedSeries[trimmedSeries.length - 1] : 0,
  marketCap: 0,
  change24h: 0,
  series: trimmedSeries,
  candles: normalizedCandles,
  updatedAt: Date.now()
};

fs.writeFileSync(DATA_PATH, JSON.stringify(snapshot, null, 2));

console.log("VALKI candles imported:", trimmedSeries.length);
