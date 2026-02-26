/**
 * GET  /api/drivers/[id] — détail d'un chauffeur
 * PATCH /api/drivers/[id] — mise à jour nom/initiales
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { drivers, userCompanies } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

async function getCompanyId(userId: string) {
  const [uc] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, userId))
    .limit(1)
  return uc?.companyId ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const driverId = parseInt(id)
  const companyId = await getCompanyId(session.user.id)

  const conditions: any[] = [eq(drivers.id, driverId)]
  if (companyId) conditions.push(eq(drivers.companyId, companyId))

  const [driver] = await db.select().from(drivers).where(and(...conditions)).limit(1)

  if (!driver) return NextResponse.json({ error: 'Chauffeur non trouvé' }, { status: 404 })
  return NextResponse.json(driver)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const driverId = parseInt(id)
  const companyId = await getCompanyId(session.user.id)

  try {
    const body = await request.json()
    const { name, initials, status, phone, email } = body

    const update: Record<string, any> = {}
    if (name     !== undefined) update.name     = name
    if (initials !== undefined) update.initials = initials
    if (status   !== undefined) update.status   = status
    if (phone    !== undefined) update.phone    = phone
    if (email    !== undefined) update.email    = email

    const conditions: any[] = [eq(drivers.id, driverId)]
    if (companyId) conditions.push(eq(drivers.companyId, companyId))

    const [updated] = await db
      .update(drivers)
      .set(update)
      .where(and(...conditions))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Chauffeur non trouvé' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
