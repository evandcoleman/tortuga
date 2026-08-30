/**
 * Maps `items` through `fn` with at most `limit` calls in flight at once,
 * preserving input order in the returned array. A rejection from any call
 * propagates via `Promise.all`, but in-flight workers keep running until
 * they finish (or reject) — the rejection does not cancel them.
 */
export async function mapWithConcurrency<I, O>(
  items: I[],
  limit: number,
  fn: (item: I) => Promise<O>,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
