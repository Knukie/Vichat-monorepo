import crypto from "crypto";
import { AUTH_POSTMESSAGE_TYPE, cleanText } from "./utils.js";
import { config, corsOrigins, ensureSharedEnv } from "./config.js";

ensureSharedEnv();

export function b64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function b64urlDecode(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s + pad, "base64");
}

export function signAuthToken(payload, expiresInSeconds = 60 * 60 * 24 * 14) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(body));
  const data = `${h}.${p}`;

  const sig = crypto.createHmac("sha256", config.AUTH_TOKEN_SECRET).update(data).digest();
  return `${data}.${b64urlEncode(sig)}`;
}

export function verifyAuthToken(token) {
  const t = cleanText(token);
  if (!t) return null;

  const parts = t.split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;

  const expected = crypto.createHmac("sha256", config.AUTH_TOKEN_SECRET).update(data).digest();
  const got = b64urlDecode(s);

  if (got.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(got, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp || now > payload.exp) return null;

  return payload;
}

export function getBearerToken(req) {
  const h = cleanText(req.headers.authorization);
  if (!h) return "";
  const m = h.match(/^Bearer\\s+(.+)$/i);
  return m ? cleanText(m[1]) : "";
}

export function optionalAuth(req, _res, next) {
  const tok = getBearerToken(req);
  if (!tok) {
    req.user = null;
    return next();
  }

  const payload = verifyAuthToken(tok);
  if (!payload?.uid) {
    req.user = null;
    return next();
  }

  const displayName = cleanText(payload.displayName || payload.name) || "";
  req.user = {
    id: Number(payload.uid),
    name: displayName,
    displayName,
    provider: cleanText(payload.provider) || "discord"
  };
  return next();
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user?.id) return res.status(401).json({ error: "Not logged in" });
    next();
  });
}

export function isAllowedReturnOrigin(origin) {
  const o = cleanText(origin);
  if (!o) return false;
  return corsOrigins.includes(o);
}

export function htmlPopupDone({ token, user, targetOrigin }) {
  const safeOrigin = isAllowedReturnOrigin(targetOrigin)
    ? targetOrigin
    : corsOrigins[0] || "https://valki.wiki";

  const payload = JSON.stringify({ type: AUTH_POSTMESSAGE_TYPE, token, user });

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
<script>
(function(){
  try {
    var data = ${payload};
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(data, ${JSON.stringify(safeOrigin)});
    }
  } catch(e){}
  window.close();
})();
</script>
</body>
</html>`;
}
