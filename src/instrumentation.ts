export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerAllModules } = await import('./modules');
    registerAllModules();
  }
}
