import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests, sends } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

export default function History() {
  const ctx = getAppContext();
  const rows = ctx.db
    .select()
    .from(digests)
    .orderBy(desc(digests.scheduledAt))
    .limit(50)
    .all();
  const counts: Record<string, Record<string, number>> = {};
  for (const s of ctx.db
    .select({ digestId: sends.digestId, status: sends.status })
    .from(sends)
    .all()) {
    counts[s.digestId] = counts[s.digestId] ?? {};
    counts[s.digestId][s.status] = (counts[s.digestId][s.status] ?? 0) + 1;
  }
  return (
    <div>
      <h2>History</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>When</th>
            <th>Status</th>
            <th>Items</th>
            <th>Sent</th>
            <th>Failed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(d => (
            <tr key={d.id} style={{ borderTop: '1px solid #1e242e' }}>
              <td>{d.scheduledAt.toISOString()}</td>
              <td>{d.status}</td>
              <td>{d.itemCount}</td>
              <td>{counts[d.id]?.sent ?? 0}</td>
              <td>{counts[d.id]?.failed ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
