import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { db } from '@/db';
import { env } from '@/lib/env';
import * as authSchema from '@/db/auth-schema';
import { users as domainUsers } from '@/db/schema';
import { audit } from '@/lib/audit';

const resend = new Resend(env.RESEND_API_KEY);

export const auth = betterAuth({
  appName: 'Cultural Layer Recklinghausen',
  // Adapter requires the explicit schema object — without it, Better Auth falls back to
  // introspection and breaks under strict TS.
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
    },
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // Pitfall 6 / T-0-07 mitigation: when Better Auth provisions a new `user` row, mirror to our
  // domain `users` table. Phase 0 hook is intentionally minimal (default role = 'public', no
  // admin escalation). Phase 1 will exercise this hook against the real magic-link UI and add
  // invite-based role assignment.
  databaseHooks: {
    user: {
      create: {
        after: async (createdAuthUser) => {
          // Create or attach a domain users row keyed off Better Auth user.id.
          // Use email as the bridge key; domain users.id gets a fresh UUID from Postgres.
          await db
            .insert(domainUsers)
            .values({
              email: createdAuthUser.email,
              role: 'public',
              status: 'active',
            })
            .onConflictDoNothing({ target: domainUsers.email });
          // Audit the bootstrap so we can trace bridge events post-Phase-1.
          await audit({
            actorUserId: null,
            action: 'event.bootstrap',
            target: `auth-user:${createdAuthUser.id}`,
            meta: {
              email: createdAuthUser.email,
              source: 'better-auth.databaseHooks.user.create',
            },
          });
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 min — REQ-magic-link-auth (Phase 1 acceptance)
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: 'Cultural Layer <onboarding@resend.dev>', // Phase 6: swap to verified domain
          to: email,
          subject: 'Dein Login-Link',
          html: `<p>Klicke hier, um dich anzumelden: <a href="${url}">${url}</a></p>
                 <p>Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden.</p>`,
        });
      },
    }),
  ],
});
