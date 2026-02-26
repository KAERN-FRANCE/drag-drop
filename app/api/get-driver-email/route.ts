/**
 * POST /api/get-driver-email — retourne l'email d'un utilisateur par son ID Better Auth
 * Remplace l'ancienne version qui appelait supabase.auth.admin.getUserById().
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ email: null }, { status: 401 })

  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ email: null })

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
