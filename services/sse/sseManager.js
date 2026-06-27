// Per-job SSE fan-out with a global admin channel.
// Replay uses MongoDB as the durable source; clients send Last-Event-ID
// to the stream endpoint which queries from that seq onward.

const GLOBAL_CHANNEL = "__global__";

// clients: Map<jobId | GLOBAL_CHANNEL, Set<res>>
const clients = new Map();

function getOrCreate(channel) {
  if (!clients.has(channel)) clients.set(channel, new Set());
  return clients.get(channel);
}

export function subscribe(jobId, res) {
  const group = getOrCreate(jobId);
  group.add(res);
  res.on("close", () => {
    group.delete(res);
    if (group.size === 0) clients.delete(jobId);
  });
}

export function subscribeGlobal(res) {
  const group = getOrCreate(GLOBAL_CHANNEL);
  group.add(res);
  res.on("close", () => {
    group.delete(res);
    if (group.size === 0) clients.delete(GLOBAL_CHANNEL);
  });
}

export function publish(jobId, event) {
  const line = formatEvent(event);

  const group = clients.get(jobId);
  if (group) group.forEach((c) => c.write(line));

  // Admin dashboard global channel — only job-level phase changes
  const global = clients.get(GLOBAL_CHANNEL);
  if (global) global.forEach((c) => c.write(line));
}

export function clientCount(jobId) {
  return clients.get(jobId)?.size ?? 0;
}

function formatEvent(event) {
  const id = event.seq != null ? `id:${event.seq}\n` : "";
  return `${id}data:${JSON.stringify(event)}\n\n`;
}
