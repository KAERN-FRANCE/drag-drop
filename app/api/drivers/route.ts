/**
 * GET  /api/drivers  — liste les chauffeurs de l'entreprise
 * POST /api/drivers  — crée un chauffeur (remplace /api/create-driver)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { drivers, userCompanies, user as userTable } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'

// ── Helper : récupère le companyId de la session ───────────
async function getSessionCompanyId(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { session: null, companyId: null }

  const [uc] = await db
    .select({ companyId: userCompanies.companyId, role: userCompanies.role })
    .from(userCompanies)
    .where(eq(userCompanies.userId, session.user.id))
    .limit(1)

  return { session, companyId: uc?.companyId ?? null, role: uc?.role ?? null }
}

// ══════════════════════════════════════════════════════
// GET /api/drivers
// ══════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  const { session, companyId } = await getSessionCompanyId(request)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const rows = await db
    .select()
    .from(drivers)
    .where(companyId ? eq(drivers.companyId, companyId) : undefined)
    .orderBy(drivers.name)

  return NextResponse.json({ drivers: rows })
}

// ══════════════════════════════════════════════════════
// POST /api/drivers  — crée un chauffeur avec compte Better Auth
// ══════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  const { session, companyId, role } = await getSessionCompanyId(request)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  if (!companyId) {
    return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 400 })
  }

  const { name, email, password, phone } = await request.json()

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'Champs obligatoires manquants (nom, email, mot de passe)' },
      { status: 400 }
    )
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 6 caractères' },
      { status: 400 }
    )
  }

  // 1. Créer le compte Better Auth via l'API admin interne
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

  // 3. Insérer le chauffeur
  const [driver] = await db
    .insert(drivers)
    .values({
      companyId,
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
  const { userCompanies: userCompaniesTable } = await import('@/lib/schema')
  await db.insert(userCompaniesTable).values({
    userId: newUserId,
    companyId,
    role: 'driver',
  })

  return NextResponse.json({ success: true, driver })
}
