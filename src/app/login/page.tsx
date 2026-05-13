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
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0f1115',
        color: '#e7e9ee',
      }}
    >
      <form
        action={action}
        style={{ background: '#181c25', padding: 32, borderRadius: 12, width: 320 }}
      >
        <h1 style={{ margin: 0, marginBottom: 16 }}>Tortuga</h1>
        <input name="email" type="email" placeholder="Email" required style={inputStyle} />
        <input name="password" type="password" placeholder="Password" required style={inputStyle} />
        {params.error ? <p style={{ color: '#ff6b6b' }}>Invalid credentials.</p> : null}
        <button type="submit" style={btnStyle}>
          Sign in
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 8,
  marginBottom: 12,
  background: '#0f1115',
  color: '#e7e9ee',
  border: '1px solid #2a3140',
  borderRadius: 6,
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  background: '#4f7cff',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
};
