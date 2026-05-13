import argon2 from 'argon2';
import { createId } from '@paralleldrive/cuid2';
import type { Db } from '@/kernel/db/client';
import { users } from '@/kernel/db/schema';

export async function bootstrapAdminUser(db: Db, args: { email: string; password: string }) {
  const existing = db.select().from(users).all();
  if (existing.length > 0) return;
  const passwordHash = await argon2.hash(args.password, { type: argon2.argon2id });
  db.insert(users).values({
    id: createId(),
    email: args.email,
    passwordHash,
    createdAt: new Date(),
  }).run();
}
