import { getAppContext } from '@/kernel/context';
import { recipientsCache } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

export default function Recipients() {
  const ctx = getAppContext();
  const rows = ctx.db.select().from(recipientsCache).all();
  const active = rows.filter(r => r.active);
  const inactive = rows.filter(r => !r.active);
  return (
    <div>
      <h2>Recipients</h2>
      <p>
        {active.length} active, {inactive.length} unsubscribed.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Plex</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.email} style={{ borderTop: '1px solid #1e242e' }}>
              <td>{r.email}</td>
              <td>{r.name}</td>
              <td>{r.plexUsername}</td>
              <td>{r.active ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
