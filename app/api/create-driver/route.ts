/**
 * POST /api/create-driver — crée un chauffeur avec compte Better Auth
 * Remplace l'ancienne version Supabase admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { drivers, userCompanies } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const body = await request.json()
    const { name, email, password, phone } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants (nom, email, mot de passe)' },
        { status: 400 }
      )
    }

    // Get companyId from session
    const [uc] = await db
      .select({ companyId: userCompanies.companyId })
      .from(userCompanies)
      .where(eq(userCompanies.userId, session.user.id))
      .limit(1)

    const companyId = uc?.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'Entreprise introuvable pour cet utilisateur' }, { status: 403 })
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    // 1. Créer le compte Better Auth
    const signUpRes = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: request.headers,
    })

    if (!signUpRes?.user) {
      return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
    }

    const newUserId = signUpRes.user.id

    // 2. Générer les initiales
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    // 3. Insérer le chauffeur en base
    const [driver] = await db
      .insert(drivers)
      .values({
        companyId: Number(companyId),
        userId: newUserId,
        name: name.trim(),
        initials,
        email,
        phone: phone || null,
        score: 100,
        status: 'active',
      })
      .returning()

    // 4. Lier l'utilisateur à l'entreprise avec le rôle driver
    await db.insert(userCompanies).values({
      userId: newUserId,
      companyId: Number(companyId),
      role: 'driver',
    })

    return NextResponse.json({ success: true, driver, message: 'Chauffeur créé avec succès' })
  } catch (error: any) {
    console.error('Erreur create-driver:', error)
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé par un autre compte' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
