/**
 * DELETE /api/delete-driver — supprime un chauffeur + ses analyses + infractions
 * Remplace l'ancienne version Supabase admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { drivers, infractions, analyses, userCompanies } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

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
    const { driverId } = await request.json()
    if (!driverId) {
      return NextResponse.json({ error: 'ID chauffeur manquant' }, { status: 400 })
    }

    const id = Number(driverId)

    // Vérifier que le chauffeur appartient à la même entreprise
    const [driver] = await db
      .select({ userId: drivers.userId, companyId: drivers.companyId })
      .from(drivers)
      .where(and(eq(drivers.id, id), eq(drivers.companyId, uc.companyId)))
      .limit(1)

    if (!driver) return NextResponse.json({ error: 'Chauffeur non trouvé' }, { status: 404 })

    // Les infractions et analyses seront supprimées en cascade via FK
    // mais on les supprime explicitement pour s'assurer de l'ordre
    await db.delete(infractions).where(eq(infractions.driverId, id))
    await db.delete(analyses).where(eq(analyses.driverId, id))

    const { rowCount } = await db.delete(drivers).where(eq(drivers.id, id))

    if (!rowCount) {
      return NextResponse.json({ error: 'Chauffeur non trouvé' }, { status: 404 })
    }

    // Note : la suppression du compte Better Auth (user table) se fait via ON DELETE CASCADE
    // sur user_companies. L'utilisateur conserve son compte mais perd le lien entreprise.
    // Pour supprimer le compte complètement, utiliser auth.api.deleteUser si nécessaire.

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur delete-driver:', error)
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
