/**
 * GET   /api/account — infos du compte connecté
 * PATCH /api/account — mise à jour du nom
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const [u] = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1)

  return NextResponse.json(u ?? null)
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const [updated] = await db
      .update(userTable)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(userTable.id, session.user.id))
      .returning({ id: userTable.id, name: userTable.name, email: userTable.email })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
