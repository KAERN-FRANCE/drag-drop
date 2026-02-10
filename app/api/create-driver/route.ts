import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { name, email, password, companyId } = body

    if (!name || !email || !password || !companyId) {
      return NextResponse.json(
        { error: 'Tous les champs sont obligatoires (nom, email, mot de passe)' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    // 1. Créer le compte auth via admin API (bypass email validation + rate limits)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmer automatiquement l'email
      user_metadata: {
        full_name: name,
        role: 'driver',
      },
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé par un autre compte' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: `Erreur création compte: ${authError.message}` },
        { status: 400 }
      )
    }

    // 2. Générer les initiales
    const initials = name
      .split(' ')
      .filter((n: string) => n.length > 0)
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    // 3. Insérer le chauffeur dans la table drivers avec user_id
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .insert({
        company_id: parseInt(companyId),
        name: name.trim(),
        initials,
        score: 100,
        status: 'active',
        user_id: authData.user.id,
      })
      .select()
      .single()

    if (driverError) {
      // Rollback: supprimer le compte auth si l'insert driver échoue
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Erreur création chauffeur: ${driverError.message}` },
        { status: 500 }
      )
    }

    // 4. Lier le chauffeur à l'entreprise dans user_companies
    await supabaseAdmin.from('user_companies').insert({
      user_id: authData.user.id,
      company_id: parseInt(companyId),
      role: 'driver',
    })

    return NextResponse.json({
      success: true,
      driver,
      message: 'Chauffeur créé avec succès',
    })
  } catch (error: any) {
    console.error('Error in create-driver API:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur interne' },
      { status: 500 }
    )
  }
}
