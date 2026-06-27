export function requireBearer(req, res, next) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "") || null;
  const expected = process.env.API_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function requireWebhookSecret(req, res, next) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "") || null;
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
