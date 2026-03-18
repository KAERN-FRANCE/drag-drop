/**
 * POST /api/get-driver-email — retourne l'email d'un utilisateur par son ID Better Auth
 * Remplace l'ancienne version qui appelait supabase.auth.admin.getUserById().
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user as userTable, drivers, userCompanies } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ email: null }, { status: 401 })

  // Vérifier l'entreprise de l'utilisateur
  const [uc] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, session.user.id))
    .limit(1)
  if (!uc) return NextResponse.json({ email: null }, { status: 403 })

  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ email: null })

    // Vérifier que l'utilisateur demandé appartient à la même entreprise
    const [driver] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(and(eq(drivers.userId, userId), eq(drivers.companyId, uc.companyId)))
      .limit(1)
    if (!driver) return NextResponse.json({ email: null }, { status: 403 })

    const [u] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    return NextResponse.json({ email: u?.email ?? null })
  } catch {
    return NextResponse.json({ email: null })
  }
}
