import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/kernel/auth/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const mode = process.env.AUTH_MODE ?? 'session';
  if (mode === 'session') {
    const session = await auth();
    if (!session?.user) redirect('/login');
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        minHeight: '100vh',
        background: '#0f1115',
        color: '#e7e9ee',
      }}
    >
      <nav
        style={{
          background: '#0b0d12',
          padding: 24,
          borderRight: '1px solid #1e242e',
        }}
      >
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Tortuga</h1>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            marginTop: 24,
            display: 'grid',
            gap: 8,
          }}
        >
          <li>
            <Link href="/">Dashboard</Link>
          </li>
          <li>
            <Link href="/newsletter">Newsletter</Link>
          </li>
          <li>
            <Link href="/newsletter/preview">Preview</Link>
          </li>
          <li>
            <Link href="/newsletter/history">History</Link>
          </li>
          <li>
            <Link href="/newsletter/recipients">Recipients</Link>
          </li>
        </ul>
      </nav>
      <main style={{ padding: 32 }}>{children}</main>
    </div>
  );
}
