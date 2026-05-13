import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAppContext } from '@/kernel/context';
import { users } from '@/kernel/db/schema';

const CredsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = CredsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { db } = getAppContext();
        const found = db.select().from(users).where(eq(users.email, parsed.data.email)).all();
        if (found.length === 0 || !found[0].passwordHash) return null;
        const ok = await argon2.verify(found[0].passwordHash, parsed.data.password);
        if (!ok) return null;
        return { id: found[0].id, email: found[0].email };
      },
    }),
  ],
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
