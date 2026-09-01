import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { readConfigOverride, writeConfigOverride, clearConfigOverride } from './overrides';
import { NewsletterConfigSchema, PortalConfigSchema } from './schema';

function freshDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  return db;
}

const sample = NewsletterConfigSchema.parse({
  from: { email: 'a@b.com', name: 'A' },
  schedule: '0 8 * * MON',
});

describe('config overrides (newsletter section)', () => {
  it('returns null when no override exists', () => {
    expect(readConfigOverride(freshDb(), 'newsletter', NewsletterConfigSchema)).toBeNull();
  });

  it('round-trips a written override', () => {
    const db = freshDb();
    writeConfigOverride(db, 'newsletter', sample);
    const got = readConfigOverride(db, 'newsletter', NewsletterConfigSchema);
    expect(got?.schedule).toBe('0 8 * * MON');
    expect(got?.from.email).toBe('a@b.com');
  });

  it('overwrites the single row on repeated writes', () => {
    const db = freshDb();
    writeConfigOverride(db, 'newsletter', sample);
    writeConfigOverride(db, 'newsletter', { ...sample, schedule: '0 9 * * SUN' });
    expect(readConfigOverride(db, 'newsletter', NewsletterConfigSchema)?.schedule).toBe('0 9 * * SUN');
    const count = db.$client.prepare('SELECT COUNT(*) as n FROM config_overrides').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('returns null and does not throw on invalid stored JSON', () => {
    const db = freshDb();
    db.$client.prepare('INSERT INTO config_overrides (section, value, updated_at) VALUES (?, ?, ?)')
      .run('newsletter', '{ not valid json', Date.now());
    expect(readConfigOverride(db, 'newsletter', NewsletterConfigSchema)).toBeNull();
  });

  it('clear removes the row', () => {
    const db = freshDb();
    writeConfigOverride(db, 'newsletter', sample);
    clearConfigOverride(db, 'newsletter');
    expect(readConfigOverride(db, 'newsletter', NewsletterConfigSchema)).toBeNull();
  });
});

describe('config overrides (section isolation)', () => {
  it('keeps newsletter and portal overrides in separate rows', () => {
    const db = freshDb();
    const portalSample = PortalConfigSchema.parse({ enabled: true, domain: 'plex.example.com' });
    writeConfigOverride(db, 'newsletter', sample);
    writeConfigOverride(db, 'portal', portalSample);

    expect(readConfigOverride(db, 'newsletter', NewsletterConfigSchema)?.schedule).toBe('0 8 * * MON');
    expect(readConfigOverride(db, 'portal', PortalConfigSchema)?.domain).toBe('plex.example.com');

    const count = db.$client.prepare('SELECT COUNT(*) as n FROM config_overrides').get() as { n: number };
    expect(count.n).toBe(2);
  });

  it('clearing one section does not affect another', () => {
    const db = freshDb();
    const portalSample = PortalConfigSchema.parse({ enabled: true });
    writeConfigOverride(db, 'newsletter', sample);
    writeConfigOverride(db, 'portal', portalSample);

    clearConfigOverride(db, 'portal');

    expect(readConfigOverride(db, 'newsletter', NewsletterConfigSchema)).not.toBeNull();
    expect(readConfigOverride(db, 'portal', PortalConfigSchema)).toBeNull();
  });
});
