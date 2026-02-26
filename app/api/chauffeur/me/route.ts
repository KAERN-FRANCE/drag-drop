/**
 * GET   /api/chauffeur/me — profil du chauffeur connecté + score + stats
 * PATCH /api/chauffeur/me — mise à jour du nom
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { drivers, infractions, analyses } from '@/lib/schema'
import { eq, gte, and, desc, asc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.userId, session.user.id))
      .limit(1)

    if (!driver) return NextResponse.json({ driver: null })

    // Infractions des 3 derniers mois
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const dateLimit = threeMonthsAgo.toISOString().split('T')[0]

    const infData = await db
      .select()
      .from(infractions)
      .where(and(eq(infractions.driverId, driver.id), gte(infractions.date, dateLimit)))
      .orderBy(desc(infractions.date))

    let score = 100
    infData.forEach(inf => { score -= penalites[inf.severity] || 1 })
    score = Math.max(0, Math.min(100, score))

    // Analyses pour l'évolution
    const analysesData = await db
      .select({ id: analyses.id, score: analyses.score, periodEnd: analyses.periodEnd, periodStart: analyses.periodStart })
      .from(analyses)
      .where(eq(analyses.driverId, driver.id))
      .orderBy(asc(analyses.periodEnd))

    // Nombre total d'analyses
    const analysesCount = analysesData.length

    return NextResponse.json({
      driver: { ...driver, score },
      infractions: infData,
      analyses: analysesData,
      stats: {
        score,
        infractions3m: infData.length,
        analysesCount,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const initials = name.trim()
      .split(' ')
      .filter((n: string) => n.length > 0)
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    const [updated] = await db
      .update(drivers)
      .set({ name: name.trim(), initials })
      .where(eq(drivers.userId, session.user.id))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Chauffeur non trouvé' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
