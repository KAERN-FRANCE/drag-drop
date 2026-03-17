/**
 * GET /api/infractions — liste les infractions de l'entreprise
 * Query params optionnels : dateFrom, dateTo, driverId, analysisId
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { infractions, userCompanies } from '@/lib/schema'
import { eq, gte, lte, and, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const dateFrom   = searchParams.get('dateFrom')
    const dateTo     = searchParams.get('dateTo')
    const driverId   = searchParams.get('driverId')
    const analysisId = searchParams.get('analysisId')

    const [uc] = await db
      .select({ companyId: userCompanies.companyId })
      .from(userCompanies)
      .where(eq(userCompanies.userId, session.user.id))
      .limit(1)

    const companyId = uc?.companyId

    const conditions: any[] = []
    if (companyId)  conditions.push(eq(infractions.companyId, companyId))
    if (dateFrom)   conditions.push(gte(infractions.date, dateFrom))
    if (dateTo)     conditions.push(lte(infractions.date, dateTo))
    if (driverId)   conditions.push(eq(infractions.driverId, parseInt(driverId)))
    if (analysisId) conditions.push(eq(infractions.analysisId, parseInt(analysisId)))

    const data = await db
      .select()
      .from(infractions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(infractions.date))

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
