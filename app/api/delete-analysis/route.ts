/**
 * DELETE /api/delete-analysis — supprime une analyse + ses infractions, recalcule le score
 * Remplace l'ancienne version Supabase admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { analyses, infractions, drivers, userCompanies } from '@/lib/schema'
import { eq, and, gte } from 'drizzle-orm'

const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Vérifier l'entreprise de l'utilisateur
  const [uc] = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, session.user.id))
    .limit(1)
  if (!uc) return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 403 })

  try {
    const { analysisId } = await request.json()
    if (!analysisId) {
      return NextResponse.json({ error: 'ID analyse manquant' }, { status: 400 })
    }

    const id = Number(analysisId)

    // Vérifier que l'analyse appartient à la même entreprise
    const [analysis] = await db
      .select({ driverId: analyses.driverId })
      .from(analyses)
      .where(and(eq(analyses.id, id), eq(analyses.companyId, uc.companyId)))
      .limit(1)

    if (!analysis) return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 })

    const driverId = analysis?.driverId

    // Supprimer les infractions liées
    await db.delete(infractions).where(eq(infractions.analysisId, id))

    // Supprimer l'analyse
    const { rowCount } = await db.delete(analyses).where(eq(analyses.id, id))

    if (!rowCount) {
      return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 })
    }

    // Recalculer le score du chauffeur sur les 12 derniers mois
    if (driverId) {
      const dateLimit = new Date()
      dateLimit.setMonth(dateLimit.getMonth() - 12)
      const dateLimitStr = dateLimit.toISOString().split('T')[0]

      const remaining = await db
        .select({ severity: infractions.severity })
        .from(infractions)
        .where(and(eq(infractions.driverId, driverId), gte(infractions.date, dateLimitStr)))

      let newScore = 100
      remaining.forEach((inf) => { newScore -= penalites[inf.severity] || 5 })
      newScore = Math.max(0, Math.min(100, newScore))

      await db.update(drivers).set({ score: newScore }).where(eq(drivers.id, driverId))
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur delete-analysis:', error)
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
