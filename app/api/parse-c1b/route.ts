import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const C1B_API_URL = process.env.C1B_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    console.log('[parse-c1b] C1B_API_URL:', C1B_API_URL)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      )
    }

    console.log('[parse-c1b] Fichier reçu:', file.name, 'taille:', file.size)

    // Forwarder le fichier à l'API Python
    const pythonFormData = new FormData()
    pythonFormData.append('file', file)

    const targetUrl = `${C1B_API_URL}/parse`
    console.log('[parse-c1b] Envoi vers:', targetUrl)

    // Timeout de 120 secondes
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000)

    let response
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        body: pythonFormData,
        signal: controller.signal,
      })
    } catch (fetchError: any) {
      clearTimeout(timeout)
      console.error('[parse-c1b] Fetch error:', fetchError?.message, fetchError?.cause)

      if (fetchError?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Le parser C1B a mis trop de temps à répondre (timeout 120s)' },
          { status: 504 }
        )
      }
      throw fetchError
    }
    clearTimeout(timeout)

    console.log('[parse-c1b] Réponse du parser:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[parse-c1b] Erreur du parser:', errorText)
      let errorMessage = `Erreur du parser C1B (${response.status})`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.detail || errorMessage
      } catch {}
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[parse-c1b] Succès, drivers trouvés:', data.drivers_found)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[parse-c1b] Exception:', error?.message, error?.cause)

    if (error?.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: `Le service de parsing C1B n'est pas disponible sur ${C1B_API_URL}` },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Erreur interne lors du parsing C1B' },
      { status: 500 }
    )
  }
}
