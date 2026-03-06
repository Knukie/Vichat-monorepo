import express from "express";
import { getValkiSnapshot } from "../services/valkiSnapshot.js";

export const valkiRoutes = express.Router();

valkiRoutes.get("/snapshot", (req, res) => {
  const range = typeof req.query?.range === "string" ? req.query.range : undefined;
  const snapshot = getValkiSnapshot(range);
  return res.json(
    snapshot || {
      price: 0,
      marketCap: 0,
      change24h: 0,
      series: [],
      candles: [],
      updatedAt: Date.now()
    }
  );
});
