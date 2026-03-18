/**
 * POST /api/create-driver — crée un chauffeur avec compte Better Auth
 * Remplace l'ancienne version Supabase admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { drivers, userCompanies } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'

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
      console.log('[create-driver] Invitation email sent to', email)
    } catch (err) {
      console.error('[create-driver] Failed to send invitation email:', err)
    }

    return NextResponse.json({ success: true, driver, message: 'Chauffeur créé avec succès' })
  } catch (error: any) {
    console.error('Erreur create-driver:', error)
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé par un autre compte' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
