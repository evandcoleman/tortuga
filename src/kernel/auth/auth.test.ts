import { describe, it, expect } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { bootstrapAdminUser } from './bootstrap';
import { users } from '@/kernel/db/schema';

describe('bootstrapAdminUser', () => {
  it('creates a user if none exist', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    await bootstrapAdminUser(db, { email: 'a@x.io', password: 'hunter22hunter22' });
    const rows = db.select().from(users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('a@x.io');
    expect(rows[0].passwordHash).toBeTruthy();
  });
  it('is a no-op when a user already exists', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    await bootstrapAdminUser(db, { email: 'a@x.io', password: 'hunter22hunter22' });
    await bootstrapAdminUser(db, { email: 'b@x.io', password: 'hunter22hunter22' });
    expect(db.select().from(users).all()).toHaveLength(1);
  });
});
