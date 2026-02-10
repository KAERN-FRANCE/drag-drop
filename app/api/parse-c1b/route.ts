import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const C1B_API_URL = process.env.C1B_API_URL || 'http://localhost:8000'

// GET pour tester la connectivité avec le parser
export async function GET() {
  try {
    const response = await fetch(`${C1B_API_URL}/`, { signal: AbortSignal.timeout(10000) })
    const data = await response.json()
    return NextResponse.json({ status: 'ok', parser_url: C1B_API_URL, parser_response: data })
  } catch (error: any) {
    return NextResponse.json({ status: 'error', parser_url: C1B_API_URL, error: error?.message }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  console.log('[parse-c1b] POST reçu, C1B_API_URL:', C1B_API_URL)

  try {
    const formData = await request.formData()
    console.log('[parse-c1b] formData parsé')

    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    console.log('[parse-c1b] Fichier:', file.name, 'taille:', file.size, 'type:', file.type)

    // Lire le fichier en buffer pour le re-envoyer proprement
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' })

    const pythonFormData = new FormData()
    pythonFormData.append('file', blob, file.name)

    const targetUrl = `${C1B_API_URL}/parse`
    console.log('[parse-c1b] Envoi vers:', targetUrl)

    const response = await fetch(targetUrl, {
      method: 'POST',
      body: pythonFormData,
      signal: AbortSignal.timeout(120000),
    })

    console.log('[parse-c1b] Réponse:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[parse-c1b] Erreur:', errorText)
      let errorMessage = `Erreur du parser C1B (${response.status})`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.detail || errorMessage
      } catch {}
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const data = await response.json()
    console.log('[parse-c1b] Succès, drivers:', data.drivers_found)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[parse-c1b] Exception:', error?.message, error?.cause)

    if (error?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout: le parser n\'a pas répondu en 120s' }, { status: 504 })
    }
    if (error?.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json({ error: `Parser indisponible: ${C1B_API_URL}` }, { status: 503 })
    }

    return NextResponse.json({ error: error?.message || 'Erreur interne' }, { status: 500 })
  }
}
