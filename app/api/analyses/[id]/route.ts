/**
 * GET  /api/analyses/[id] — détail d'une analyse + chauffeur + infractions
 * PUT  /api/analyses/[id] — re-analyser avec une nouvelle période
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyses, infractions, drivers, userCompanies } from '@/lib/schema'
import { eq, and, gte } from 'drizzle-orm'
import { detecterInfractionsChronologiques } from '@/lib/chrono-infractions'
import { calculerScoreConformite } from '@/lib/analyse-infractions'

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

  // Déterminer la plage des données brutes et calculer les stats journalières
  let rawDataRange = null
  let dailyStats: Array<{
    date: string
    dateLabel: string
    drivingMinutes: number
    workMinutes: number
    restMinutes: number
    availabilityMinutes: number
    amplitudeMinutes: number
  }> = []

  const hasRawActivities = !!analysis.rawActivities
  if (hasRawActivities) {
    try {
      const acts = JSON.parse(analysis.rawActivities!) as Array<{
        type: string
        start: string
        end: string
        duration_minutes: number
      }>
      if (acts.length > 0) {
        const dates = acts.map(a => a.start.split('T')[0]).sort()
        rawDataRange = { min: dates[0], max: dates[dates.length - 1] }

        // Calculer les stats par jour
        const dayMap = new Map<string, {
          driving: number
          work: number
          rest: number
          availability: number
          firstTs: number
          lastTs: number
        }>()

        for (const act of acts) {
          const day = act.start.split('T')[0]
          if (!dayMap.has(day)) {
            dayMap.set(day, { driving: 0, work: 0, rest: 0, availability: 0, firstTs: Infinity, lastTs: 0 })
          }
          const d = dayMap.get(day)!
          const startTs = new Date(act.start).getTime()
          const endTs = new Date(act.end).getTime()

          if (act.type === 'DRIVING') d.driving += act.duration_minutes
          else if (act.type === 'WORK') d.work += act.duration_minutes
          else if (act.type === 'REST') d.rest += act.duration_minutes
          else if (act.type === 'AVAILABILITY') d.availability += act.duration_minutes

          if (act.type !== 'REST') {
            if (startTs < d.firstTs) d.firstTs = startTs
            if (endTs > d.lastTs) d.lastTs = endTs
          }
        }

        // Filtrer sur la période de l'analyse
        const periodStartDate = analysis.periodStart
        const periodEndDate = analysis.periodEnd

        dailyStats = Array.from(dayMap.entries())
          .filter(([date]) => date >= periodStartDate && date <= periodEndDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, stats]) => {
            const [y, m, day] = date.split('-').map(Number)
            const d = new Date(y, m - 1, day)
            const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
            const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
            return {
              date,
              dateLabel: `${JOURS[d.getDay()]}. ${day} ${MOIS[m - 1]}. ${y}`,
              drivingMinutes: Math.round(stats.driving),
              workMinutes: Math.round(stats.work),
              restMinutes: Math.round(stats.rest),
              availabilityMinutes: Math.round(stats.availability),
              amplitudeMinutes: stats.firstTs < Infinity ? Math.round((stats.lastTs - stats.firstTs) / 60000) : 0,
            }
          })
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    ...analysis,
    rawActivities: undefined, // Ne pas envoyer les données brutes au client
    driverName: driver?.name ?? null,
    driverId: driver?.id ?? analysis.driverId,
    infractions: infrData,
    hasRawActivities,
    rawDataRange,
    dailyStats,
  })
}

// ══════════════════════════════════════════════════════
// PUT /api/analyses/[id] — re-analyser avec une nouvelle période
// ══════════════════════════════════════════════════════
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (!analysis.rawActivities) {
    return NextResponse.json({ error: 'Données brutes non disponibles pour cette analyse' }, { status: 400 })
  }

  const { periodStart, periodEnd } = await request.json()
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: 'Période manquante' }, { status: 400 })
  }

  try {
    // 1. Filtrer les activités sur la nouvelle période
    const allActivities = JSON.parse(analysis.rawActivities) as Array<{
      type: string; start: string; end: string; duration_minutes: number
    }>
    const filtered = allActivities.filter(a => {
      const date = a.start.split('T')[0]
      return date >= periodStart && date <= periodEnd
    })

    // 2. Re-détecter les infractions
    const newInfractions = detecterInfractionsChronologiques(filtered as any)

    // 3. Calculer le score
    const uniqueDays = new Set(filtered.filter(a => a.type !== 'REST').map(a => a.start.split('T')[0]))
    const score = calculerScoreConformite(uniqueDays.size, newInfractions.length, newInfractions)

    // 4. Supprimer les anciennes infractions
    await db.delete(infractions).where(eq(infractions.analysisId, analysisId))

    // 5. Mettre à jour l'analyse
    await db.update(analyses).set({
      periodStart,
      periodEnd,
      score,
    }).where(eq(analyses.id, analysisId))

    // 6. Insérer les nouvelles infractions
    // Helper pour parser les dates françaises vers ISO
    const moisFr: Record<string, string> = {
      'janv': '01', 'févr': '02', 'mars': '03', 'avr': '04',
      'mai': '05', 'juin': '06', 'juil': '07', 'août': '08',
      'sept': '09', 'oct': '10', 'nov': '11', 'déc': '12'
    }
    function parseFrenchDate(frenchDate: string): string {
      const match = frenchDate.match(/(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})/i)
      if (match) {
        const jour = match[1].padStart(2, '0')
        const moisText = match[2].toLowerCase().substring(0, 4)
        const annee = match[3]
        const mois = moisFr[moisText] || '01'
        return `${annee}-${mois}-${jour}`
      }
      return new Date().toISOString().split('T')[0]
    }

    if (newInfractions.length > 0) {
      const validInfrs = newInfractions
        .map((inf: any) => ({
          driverId: analysis.driverId,
          companyId: analysis.companyId,
          analysisId,
          type: inf.type,
          severity: (inf.gravite === 'delit' ? 'critical' : inf.gravite === '5eme' ? 'high' : inf.gravite === '4eme' ? 'medium' : 'low') as 'low' | 'medium' | 'high' | 'critical',
          date: parseFrenchDate(inf.date),
          details: {
            code: inf.code,
            detail: inf.detail,
            valeur_constatee: inf.valeur_constatee,
            limite_reglementaire: inf.limite_reglementaire,
            gravite: inf.gravite,
            amende_min: inf.amende_min,
            amende_max: inf.amende_max,
            article_loi: inf.article_loi,
          },
        }))
        .filter((inf: any) => /^\d{4}-\d{2}-\d{2}$/.test(inf.date))

      if (validInfrs.length > 0) {
        await db.insert(infractions).values(validInfrs)
      }
    }

    // 7. Recalculer le score global du chauffeur
    if (analysis.driverId) {
      const dateLimit12m = new Date()
      dateLimit12m.setMonth(dateLimit12m.getMonth() - 12)
      const dateLimitStr = dateLimit12m.toISOString().split('T')[0]

      const allInfs = await db
        .select({ severity: infractions.severity })
        .from(infractions)
        .where(and(eq(infractions.driverId, analysis.driverId), gte(infractions.date, dateLimitStr)))

      const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }
      let globalScore = 100
      allInfs.forEach(inf => { globalScore -= penalites[inf.severity] || 5 })
      globalScore = Math.max(0, Math.min(100, globalScore))

      await db.update(drivers).set({ score: globalScore, updatedAt: new Date() }).where(eq(drivers.id, analysis.driverId))
    }

    return NextResponse.json({ success: true, score, infractions: newInfractions.length })
  } catch (error: any) {
    console.error('Erreur PUT /api/analyses/[id]:', error)
    return NextResponse.json({ error: error?.message || 'Erreur interne' }, { status: 500 })
  }
}
