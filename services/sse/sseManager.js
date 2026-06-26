const clients = new Map();

export function subscribe(jobId, res) {
  if (!clients.has(jobId)) {
    clients.set(jobId, new Set());
  }

  clients.get(jobId).add(res);
  res.on("close", () => {
    clients.get(jobId).delete(res);
  });
}

export function publish(jobId, event) {
  const group = clients.get(jobId);
  if (!group) return;

  group.forEach((client) => {
    client.write(`id:${event.seq}\n`);
    client.write(`data:${JSON.stringify(event)}\n\n`);
  });
}
