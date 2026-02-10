import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { driverId } = await request.json()

    if (!driverId) {
      return NextResponse.json({ error: 'ID chauffeur manquant' }, { status: 400 })
    }

    // Récupérer le user_id du chauffeur pour supprimer le compte auth
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('user_id')
      .eq('id', driverId)
      .single()

    // Supprimer les infractions liées
    await supabaseAdmin.from('infractions').delete().eq('driver_id', driverId)

    // Supprimer les analyses liées
    await supabaseAdmin.from('analyses').delete().eq('driver_id', driverId)

    // Supprimer le chauffeur
    const { error } = await supabaseAdmin.from('drivers').delete().eq('id', driverId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Supprimer le compte auth si existant
    if (driver?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(driver.user_id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erreur interne' }, { status: 500 })
  }
}
