import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: ['./src/kernel/db/schema.ts', './src/modules/*/schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: 'file:./config/tortuga.db' },
});
