const hits = new Map();

export function simpleRateLimit({ windowMs = 60_000, max = 30 } = {}) {
  return (req, res, next) => {
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown";

    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now - entry.ts > windowMs) {
      hits.set(ip, { count: 1, ts: now });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: "Too many requests" });
    return next();
  };
}
