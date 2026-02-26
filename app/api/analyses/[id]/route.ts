/**
 * GET /api/analyses/[id] — détail d'une analyse + chauffeur + infractions
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyses, infractions, drivers, userCompanies } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const analysisId = parseInt(id)

  const [uc] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, session.user.id))
    .limit(1)

  const companyId = uc?.companyId

  const conditions: any[] = [eq(analyses.id, analysisId)]
  if (companyId) conditions.push(eq(analyses.companyId, companyId))

  const [analysis] = await db.select().from(analyses).where(and(...conditions)).limit(1)
  if (!analysis) return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 })

  // Fetch driver name
  const [driver] = analysis.driverId
    ? await db.select({ name: drivers.name, id: drivers.id }).from(drivers).where(eq(drivers.id, analysis.driverId)).limit(1)
    : [null]

  // Fetch infractions
  const infrData = await db
    .select()
    .from(infractions)
    .where(eq(infractions.analysisId, analysisId))

  return NextResponse.json({
    ...analysis,
    driverName: driver?.name ?? null,
    driverId: driver?.id ?? analysis.driverId,
    infractions: infrData,
  })
}
