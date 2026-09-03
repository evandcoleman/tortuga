import { redirect } from 'next/navigation';
import { auth, signOut } from '@/kernel/auth/auth';
import { requireAdminSession } from '@/kernel/auth/require-admin-session';
import { Sidebar } from './_components/sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const mode = (process.env.AUTH_MODE ?? 'session') as 'session' | 'forward';
  let userEmail: string | null = null;
  if (mode === 'session') {
    const session = await auth();
    if (!session?.user) redirect('/login');
    userEmail = session.user.email ?? null;
  }

  async function doSignOut() {
    'use server';
    await requireAdminSession();
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex min-h-screen bg-canvas text-fg">
      <Sidebar
        userEmail={userEmail}
        authMode={mode}
        signOutAction={mode === 'session' ? doSignOut : undefined}
      />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-10 py-10">{children}</div>
      </main>
    </div>
  );
}
