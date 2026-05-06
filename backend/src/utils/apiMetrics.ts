const counts = new Map<string, number>();
const startedAt = new Date().toISOString();

export function increment(service: string): void {
  counts.set(service, (counts.get(service) ?? 0) + 1);
}

export function getMetrics() {
  return { startedAt, calls: Object.fromEntries(counts) };
}
