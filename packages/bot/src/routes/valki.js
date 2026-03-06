import express from "express";
import { getValkiSnapshot } from "../services/valkiSnapshot.js";

export const valkiRoutes = express.Router();

valkiRoutes.get("/snapshot", (_req, res) => {
  const snapshot = getValkiSnapshot();
  return res.json(
    snapshot || {
      price: 0,
      marketCap: 0,
      change24h: 0,
      series: [],
      updatedAt: Date.now()
    }
  );
});
