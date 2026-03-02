import { Router } from "express";

const chatwootRouter = Router();

// Chatwoot webhook (step 1: log + 200)
chatwootRouter.post("/webhook", (req, res) => {
  const payload = req.body ?? {};
  console.info("[chatwoot] webhook payload:\n" + JSON.stringify(payload, null, 2));
  return res.status(200).json({ ok: true });
});

export { chatwootRouter };
