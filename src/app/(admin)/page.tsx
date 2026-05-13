import { desc } from 'drizzle-orm';
import { getAppContext } from '@/kernel/context';
import { digests, sends } from '@/modules/newsletter/schema';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  const ctx = getAppContext();
  const recent = ctx.db.select().from(digests).orderBy(desc(digests.scheduledAt)).limit(5).all();
  const sendCount = ctx.db.select().from(sends).all().length;
  return (
    <div>
      <h2>Overview</h2>
      <p>Last 5 digests:</p>
      <ul>
        {recent.map(d => (
          <li key={d.id}>
            {d.scheduledAt.toISOString()} — {d.status} ({d.itemCount} items)
          </li>
        ))}
      </ul>
      <p>Total send rows: {sendCount}</p>
    </div>
  );
}
