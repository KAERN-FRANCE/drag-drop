/**
 * Better Auth — handler Next.js
 * Gère toutes les routes d'auth : /api/auth/sign-in, /api/auth/sign-up, /api/auth/sign-out, etc.
 */
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
