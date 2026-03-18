/**
 * POST /api/companies
 * Crée une entreprise et lie l'utilisateur connecté comme admin.
 * Appelé depuis la page d'inscription après la création du compte Better Auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { companies, userCompanies } from '@/lib/schema'
import { sendEmail } from '@/lib/email'

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

    // Envoyer l'email de confirmation de création de compte
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    try {
      await sendEmail({
        to: session.user.email,
        subject: 'Bienvenue sur TachoCompliance — Compte créé avec succès',
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Bienvenue sur TachoCompliance !</h2>
          <p>Bonjour ${session.user.name || ''},</p>
          <p>Votre compte a été créé avec succès et votre entreprise <strong>${name.trim()}</strong> est maintenant enregistrée.</p>
          <p>Vous pouvez dès à présent :</p>
          <ul style="color: #475569; line-height: 1.8;">
            <li>Ajouter vos chauffeurs</li>
            <li>Importer vos fichiers tachygraphe (C1B, Excel)</li>
            <li>Analyser la conformité de votre flotte</li>
          </ul>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/dashboard" style="background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accéder à mon tableau de bord
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">TachoCompliance — Gestion de conformité tachygraphe</p>
        </div>`,
      })
      console.log('[companies] Welcome email sent to', session.user.email)
    } catch (err) {
      console.error('[companies] Failed to send welcome email:', err)
    }

    return NextResponse.json({ success: true, companyId: company.id, company })
  } catch (error: any) {
    console.error('Erreur création entreprise:', error)
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
