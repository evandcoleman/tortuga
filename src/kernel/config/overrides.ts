import { eq } from 'drizzle-orm';
import type { ZodType } from 'zod';
import type { Db } from '@/kernel/db/client';
import { configOverrides } from '@/kernel/db/schema';
import { createLogger } from '@/kernel/logging/logger';

const log = createLogger('config.overrides');

/** Config section this row overrides, e.g. 'newsletter' or 'portal'. */
export type ConfigSection = string;

export function readConfigOverride<T>(db: Db, section: ConfigSection, schema: ZodType<T>): T | null {
  const row = db.select().from(configOverrides).where(eq(configOverrides.section, section)).get();
  if (!row) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(row.value));
    if (!parsed.success) {
      log.warn({ section, issues: parsed.error.issues }, 'stored config override failed validation; using file config');
      return null;
    }
    return parsed.data;
  } catch (err) {
    log.warn({ section, err }, 'stored config override is not valid JSON; using file config');
    return null;
  }
}

export function writeConfigOverride<T>(db: Db, section: ConfigSection, config: T): void {
  const value = JSON.stringify(config);
  const updatedAt = new Date();
  db.insert(configOverrides)
    .values({ section, value, updatedAt })
    .onConflictDoUpdate({ target: configOverrides.section, set: { value, updatedAt } })
    .run();
}

export function clearConfigOverride(db: Db, section: ConfigSection): void {
  db.delete(configOverrides).where(eq(configOverrides.section, section)).run();
}
