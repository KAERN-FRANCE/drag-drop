/**
 * POST /api/companies
 * Crée une entreprise et lie l'utilisateur connecté comme admin.
 * Appelé depuis la page d'inscription après la création du compte Better Auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { companies, userCompanies } from '@/lib/schema'

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const { name, siret, driverCount } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Le nom de l\'entreprise est obligatoire' }, { status: 400 })
    }

    // Créer l'entreprise
    const [company] = await db
      .insert(companies)
      .values({ name: name.trim(), siret, driverCount })
      .returning()

    // Lier l'utilisateur comme admin
    await db.insert(userCompanies).values({
      userId: session.user.id,
      companyId: company.id,
      role: 'admin',
    })

    return NextResponse.json({ success: true, companyId: company.id, company })
  } catch (error: any) {
    console.error('Erreur création entreprise:', error)
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
