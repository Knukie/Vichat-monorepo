import express from "express";
import { getValkiSnapshot } from "../services/valkiSnapshot.js";

export const valkiRoutes = express.Router();

valkiRoutes.get("/snapshot", (_req, res) => {
  res.json(getValkiSnapshot());
});
