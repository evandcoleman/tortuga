import { signIn } from '@/kernel/auth/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  async function action(formData: FormData) {
    'use server';
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    });
  }

  return (
    <main className="relative grid min-h-screen w-full place-items-center overflow-hidden bg-canvas px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--color-accent)_10%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--color-accent)_40%,transparent),transparent)]"
      />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-lo text-accent-ink shadow-lift">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3l6 4v6c0 4-2.7 6.7-6 8-3.3-1.3-6-4-6-8V7l6-4z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 12.5l1.8 1.8 3.2-3.4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-faint">Tortuga</div>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-fg">
            Sign in to continue
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">Front-of-house for your Plex server.</p>
        </div>

        <form
          action={action}
          className="rounded-xl border border-line bg-surface/80 p-6 shadow-lift backdrop-blur-sm"
        >
          <Field label="Email" name="email" type="email" autoComplete="username" required />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          {params.error ? (
            <div className="mb-3 rounded-md bg-danger/10 px-3 py-2 text-[12.5px] text-danger ring-1 ring-inset ring-danger/30">
              Invalid email or password.
            </div>
          ) : null}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[13.5px] font-semibold tracking-[-0.005em] text-accent-ink shadow-soft transition hover:bg-accent-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Sign in
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <p className="mt-6 text-center text-[11.5px] text-faint">
          Bootstrapped via <code className="font-mono text-subtle">ADMIN_EMAIL</code> /{' '}
          <code className="font-mono text-subtle">ADMIN_PASSWORD</code>.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  required,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="block w-full rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </label>
  );
}
