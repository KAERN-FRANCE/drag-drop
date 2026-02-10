import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }

function calculateScore(infractions: { severity: string }[]): number {
  let score = 100
  infractions.forEach(inf => {
    score -= penalites[inf.severity] || 5
  })
  return Math.max(0, Math.min(100, score))
}

export async function DELETE(request: NextRequest) {
  try {
    const { analysisId } = await request.json()

    if (!analysisId) {
      return NextResponse.json({ error: 'ID analyse manquant' }, { status: 400 })
    }

    // Récupérer le driver_id de l'analyse avant suppression
    const { data: analysis } = await supabaseAdmin
      .from('analyses')
      .select('driver_id')
      .eq('id', analysisId)
      .single()

    const driverId = analysis?.driver_id

    // Supprimer les infractions liées
    await supabaseAdmin.from('infractions').delete().eq('analysis_id', analysisId)

    // Supprimer l'analyse
    const { error } = await supabaseAdmin.from('analyses').delete().eq('id', analysisId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculer le score du chauffeur sur les 12 derniers mois
    if (driverId) {
      const dateLimit = new Date()
      dateLimit.setMonth(dateLimit.getMonth() - 12)
      const dateLimitStr = dateLimit.toISOString().split('T')[0]

      const { data: remainingInfractions } = await supabaseAdmin
        .from('infractions')
        .select('severity')
        .eq('driver_id', driverId)
        .gte('date', dateLimitStr)

      const newScore = calculateScore(remainingInfractions || [])

      await supabaseAdmin
        .from('drivers')
        .update({ score: newScore })
        .eq('id', driverId)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erreur interne' }, { status: 500 })
  }
}
