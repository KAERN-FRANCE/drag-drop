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
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ email: null })
    }

    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)

    return NextResponse.json({ email: user?.email || null })
  } catch {
    return NextResponse.json({ email: null })
  }
}
