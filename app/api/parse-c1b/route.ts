import { NextRequest, NextResponse } from 'next/server'

const C1B_API_URL = process.env.C1B_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      )
    }

    // Forwarder le fichier à l'API Python
    const pythonFormData = new FormData()
    pythonFormData.append('file', file)

    const response = await fetch(`${C1B_API_URL}/parse`, {
      method: 'POST',
      body: pythonFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Erreur du parser C1B' }))
      return NextResponse.json(
        { error: errorData.detail || `Erreur du parser C1B (${response.status})` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    if (error?.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Le service de parsing C1B n\'est pas disponible. Vérifiez que l\'API Python est lancée sur ' + C1B_API_URL },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Erreur interne lors du parsing C1B' },
      { status: 500 }
    )
  }
}
