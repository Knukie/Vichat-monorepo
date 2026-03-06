export interface ValkiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ValkiSnapshotRange = "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export type ValkiTimeframeCandles = Record<ValkiSnapshotRange, ValkiCandle[]>;

export interface ValkiSnapshot {
  price: number;
  marketCap: number;
  change24h: number;
  series: number[];
  candles: ValkiCandle[];
  updatedAt: number;
  range?: ValkiSnapshotRange;
}
