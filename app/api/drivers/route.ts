/**
 * GET  /api/drivers  — liste les chauffeurs de l'entreprise
 * POST /api/drivers  — crée un chauffeur (remplace /api/create-driver)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { drivers, userCompanies, user as userTable } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'

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

  // Par défaut, ne montrer que les chauffeurs actifs
  // ?includeHidden=true pour voir aussi les inactifs
  const includeHidden = request.nextUrl.searchParams.get('includeHidden') === 'true'

  const conditions = []
  if (companyId) conditions.push(eq(drivers.companyId, companyId))
  if (!includeHidden) conditions.push(eq(drivers.status, 'active'))

  const rows = await db
    .select()
    .from(drivers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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

  // 5. Envoyer l'email d'invitation avec les identifiants
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    await sendEmail({
      to: email,
      subject: 'Votre compte TachoCompliance a été créé',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Bienvenue sur TachoCompliance</h2>
        <p>Bonjour ${name},</p>
        <p>Un compte a été créé pour vous sur la plateforme TachoCompliance.</p>
        <p>Voici vos identifiants de connexion :</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Email :</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Mot de passe :</strong> ${password}</p>
        </div>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/login" style="background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Se connecter
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">Nous vous recommandons de changer votre mot de passe depuis votre profil après votre première connexion.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">TachoCompliance — Gestion de conformité tachygraphe</p>
      </div>`,
    })
    console.log('[drivers] Invitation email sent to', email)
  } catch (err) {
    console.error('[drivers] Failed to send invitation email:', err)
  }

  return NextResponse.json({ success: true, driver })
}
