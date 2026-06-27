const BEARER_TOKEN = process.env.API_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export function requireBearer(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!BEARER_TOKEN || token !== BEARER_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function requireWebhookSecret(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
