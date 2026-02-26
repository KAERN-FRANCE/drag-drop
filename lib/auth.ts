/**
 * Better Auth — configuration serveur
 * Remplace Supabase Auth pour l'authentification.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import { user, session, account, verification } from './schema'

export const auth = betterAuth({
  // ── Base de données ──────────────────────────────────
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),

  // ── Authentification email + mot de passe ────────────
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  // ── Suppression de compte ─────────────────────────────
  user: {
    deleteUser: {
      enabled: true,
    },
  },

  // ── Secret de session (BETTER_AUTH_SECRET dans .env) ─
  secret: process.env.BETTER_AUTH_SECRET!,

  // ── URL de base de l'app ─────────────────────────────
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // ── Origines de confiance ────────────────────────────
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ],
})

export type Session = typeof auth.$Infer.Session
