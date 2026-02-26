/**
 * Better Auth — client navigateur
 * Remplace `supabase.auth.*` dans les composants client ("use client").
 *
 * Utilisation :
 *   import { authClient } from "@/lib/auth-client"
 *
 *   // Connexion
 *   await authClient.signIn.email({ email, password })
 *
 *   // Inscription
 *   await authClient.signUp.email({ email, password, name })
 *
 *   // Déconnexion
 *   await authClient.signOut()
 *
 *   // Session (async)
 *   const { data } = await authClient.getSession()
 *   // data.user.id, data.user.email, data.user.name
 *
 *   // Session (hook React)
 *   const { data: session } = authClient.useSession()
 */
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
})

// Export des helpers directement utilisables
export const { signIn, signUp, signOut, useSession, getSession } = authClient
