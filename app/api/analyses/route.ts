/**
 * GET  /api/analyses  — liste les analyses de l'entreprise
 * POST /api/analyses  — crée une analyse + ses infractions (upload flow)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyses, infractions, drivers, userCompanies } from '@/lib/schema'
import { eq, desc, gte, and } from 'drizzle-orm'

async function getSessionCompanyId(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { session: null, companyId: null }

  const [uc] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, session.user.id))
    .limit(1)

  return { session, companyId: uc?.companyId ?? null }
}

// ══════════════════════════════════════════════════════
// GET /api/analyses
// ══════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  const { session, companyId } = await getSessionCompanyId(request)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const driverIdParam = searchParams.get('driverId')

  const conditions: any[] = []
  if (companyId)    conditions.push(eq(analyses.companyId, companyId))
  if (driverIdParam) conditions.push(eq(analyses.driverId, parseInt(driverIdParam)))

  const rows = await db.query.analyses.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(analyses.uploadDate)],
    with: { driver: true, infractions: { columns: { severity: true } } },
  })

  return NextResponse.json({ analyses: rows })
}

// ══════════════════════════════════════════════════════
// POST /api/analyses  — crée analyse + infractions + recalcule score chauffeur
// ══════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  const { session, companyId } = await getSessionCompanyId(request)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const { driverId, periodStart, periodEnd, score, infractionsData } = body as {
    driverId: number
    periodStart: string
    periodEnd: string
    score: number
    infractionsData: Array<{ type: string; date: string; severity: string }>
  }

  if (!driverId || !periodStart || !periodEnd) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  // 1. Créer l'analyse
  const [analysis] = await db
    .insert(analyses)
    .values({
      driverId,
      companyId: companyId ?? undefined,
      periodStart,
      periodEnd,
      score,
      status: 'completed',
    })
    .returning()

  // 2. Insérer les infractions
  if (infractionsData && infractionsData.length > 0) {
    await db.insert(infractions).values(
      infractionsData.map((inf) => ({
        driverId,
        companyId: companyId ?? undefined,
        analysisId: analysis.id,
        type: inf.type,
        severity: inf.severity as 'low' | 'medium' | 'high' | 'critical',
        date: inf.date,
      }))
    )
  }

  // 3. Recalculer le score global du chauffeur (12 derniers mois)
  const dateLimit12m = new Date()
  dateLimit12m.setMonth(dateLimit12m.getMonth() - 12)
  const dateLimitStr = dateLimit12m.toISOString().split('T')[0]

  const allInfractions = await db
    .select({ severity: infractions.severity })
    .from(infractions)
    .where(and(eq(infractions.driverId, driverId), gte(infractions.date, dateLimitStr)))

  const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }
  let globalScore = 100
  allInfractions.forEach((inf) => { globalScore -= penalites[inf.severity] || 5 })
  globalScore = Math.max(0, Math.min(100, globalScore))

  await db.update(drivers).set({ score: globalScore }).where(eq(drivers.id, driverId))

  return NextResponse.json({
    success: true,
    analysisId: analysis.id,
    driverScore: globalScore,
  })
}
