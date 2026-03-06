export interface ValkiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ValkiSnapshot {
  price: number;
  marketCap: number;
  change24h: number;
  series: number[];
  candles: ValkiCandle[];
  updatedAt: number;
}
