import { Router } from "express";
import { getValkiSnapshot } from "../services/valkiSnapshot.js";

export const valkiRoutes = Router();

valkiRoutes.get("/snapshot", (_req, res) => {
  const snapshot = getValkiSnapshot();

  if (!snapshot) {
    return res.status(503).json({ error: "VALKI snapshot unavailable" });
  }

  return res.json(snapshot);
});
