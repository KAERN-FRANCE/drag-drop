/**
 * GET /api/me
 * Retourne l'utilisateur courant + son entreprise + son rôle.
 * Remplace les appels à supabase.auth.getUser() + user_companies dans les pages client.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { userCompanies, companies } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  // Récupérer l'entreprise et le rôle de l'utilisateur
  const [uc] = await db
    .select({
      companyId: userCompanies.companyId,
      role: userCompanies.role,
      companyName: companies.name,
    })
    .from(userCompanies)
    .leftJoin(companies, eq(companies.id, userCompanies.companyId))
    .where(eq(userCompanies.userId, session.user.id))
    .limit(1)

  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    companyId: uc?.companyId ?? null,
    companyName: uc?.companyName ?? null,
    role: uc?.role ?? null,
  })
}
