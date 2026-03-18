/**
 * Better Auth — configuration serveur
 * Remplace Supabase Auth pour l'authentification.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import { user, session, account, verification } from './schema'
import { sendEmail } from './email'

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
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe — TachoCompliance',
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Réinitialisation de mot de passe</h2>
          <p>Bonjour ${user.name || ''},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe TachoCompliance.</p>
          <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="color: #64748b; font-size: 14px;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">TachoCompliance — Gestion de conformité tachygraphe</p>
        </div>`,
      })
    },
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
