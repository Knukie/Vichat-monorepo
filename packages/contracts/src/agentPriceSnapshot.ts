export type AgentPriceSnapshot = {
  id: string;
  ticker: string;
  agentId?: string | null;
  priceUsd: number;
  priceIq?: number | null;
  marketCap?: number | null;
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;
  source?: string | null;
  recordedAt: string;
};

export type AgentChartPoint = {
  time: number;
  value: number;
  priceIq?: number | null;
  marketCap?: number | null;
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;
};

export type AgentChartResponse = {
  ticker: string;
  range: string;
  updatedAt: number;
  points: AgentChartPoint[];
  candles?: Array<{
    time: number;
    close: number;
    value: number;
  }>;
  series?: number[];
};
