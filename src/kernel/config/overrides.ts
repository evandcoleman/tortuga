import { eq } from 'drizzle-orm';
import type { Db } from '@/kernel/db/client';
import { configOverrides } from '@/kernel/db/schema';
import { NewsletterConfigSchema, type NewsletterConfig } from './schema';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('config.overrides');
const ROW_ID = 1;

export function readConfigOverride(db: Db): NewsletterConfig | null {
  const row = db.select().from(configOverrides).where(eq(configOverrides.id, ROW_ID)).get();
  if (!row) return null;
  try {
    const parsed = NewsletterConfigSchema.safeParse(JSON.parse(row.value));
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, 'stored config override failed validation; using file config');
      return null;
    }
    return parsed.data;
  } catch (err) {
    log.warn({ err }, 'stored config override is not valid JSON; using file config');
    return null;
  }
}

export function writeConfigOverride(db: Db, config: NewsletterConfig): void {
  const value = JSON.stringify(config);
  const updatedAt = new Date();
  db.insert(configOverrides)
    .values({ id: ROW_ID, value, updatedAt })
    .onConflictDoUpdate({ target: configOverrides.id, set: { value, updatedAt } })
    .run();
}

export function clearConfigOverride(db: Db): void {
  db.delete(configOverrides).where(eq(configOverrides.id, ROW_ID)).run();
}
