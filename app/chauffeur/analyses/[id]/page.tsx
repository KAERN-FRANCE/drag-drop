"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DriverHeader } from "@/components/driver/driver-header"
import { ScoreGauge } from "@/components/analysis/score-gauge"
import { GravityBadge } from "@/components/analysis/gravity-badge"
import { generateAnalysisPDF } from "@/lib/generate-pdf"
import {
  ChevronLeft, Download, AlertTriangle, Calendar, Loader2, Euro, FileText, Lightbulb
} from "lucide-react"
import { supabase } from "@/lib/supabase"

const severityToGravity = (severity: string): "3eme" | "4eme" | "5eme" => {
  if (severity === 'critical') return '5eme'
  if (severity === 'high') return '4eme'
  return '3eme'
}

const severityCosts: Record<string, number> = { critical: 1500, high: 750, medium: 135, low: 90 }

const adviceMap: Record<string, string> = {
  "Conduite journalière excessive": "Limitez votre conduite à 9h par jour (10h max 2 fois par semaine).",
  "Repos journalier insuffisant": "Prenez au minimum 11h de repos consécutives par jour (ou 9h en repos réduit).",
  "Conduite continue excessive": "Faites une pause d'au moins 45 minutes après 4h30 de conduite continue.",
  "Repos hebdomadaire insuffisant": "Prenez au minimum 45h de repos hebdomadaire consécutives (ou 24h en repos réduit).",
  "Conduite 2 semaines excessive": "La conduite ne doit pas dépasser 90h sur 2 semaines consécutives.",
}

export default function DriverAnalysisDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id
  const [loading, setLoading] = useState(true)
  const [driver, setDriver] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [infractions, setInfractions] = useState<any[]>([])

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (!driverData) { setLoading(false); return }
        setDriver(driverData)

        const { data: analysisData } = await supabase
          .from('analyses')
          .select('*')
          .eq('id', id)
          .eq('driver_id', driverData.id)
          .single()

        if (analysisData) {
          setAnalysis({
            ...analysisData,
            period: `${new Date(analysisData.period_start).toLocaleDateString('fr-FR')} - ${new Date(analysisData.period_end).toLocaleDateString('fr-FR')}`,
            date: new Date(analysisData.created_at || analysisData.upload_date).toLocaleDateString('fr-FR'),
          })

          const { data: infData } = await supabase
            .from('infractions')
            .select('*')
            .eq('analysis_id', id)
            .order('date', { ascending: true })

          if (infData) setInfractions(infData)
        }
      } catch (error) {
        console.error('Error loading analysis:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Analyse non trouvée</h1>
        <Button onClick={() => router.push('/chauffeur/analyses')}>Retour aux analyses</Button>
      </div>
    )
  }

  const totalCost = infractions.reduce((sum, inf) => sum + (severityCosts[inf.severity] || 90), 0)
  const graveCounts = infractions.filter(i => i.severity === 'critical' || i.severity === 'high').length
  const mineurCounts = infractions.filter(i => i.severity === 'medium' || i.severity === 'low').length

  // Group infractions by date
  const byDate: Record<string, any[]> = {}
  infractions.forEach(inf => {
    const dateKey = inf.date?.split('T')[0] || inf.date
    if (!byDate[dateKey]) byDate[dateKey] = []
    byDate[dateKey].push(inf)
  })

  return (
    <div className="min-h-screen bg-background">
      <DriverHeader
        title="Détail de l'analyse"
        subtitle={analysis.period}
        driverName={driver?.name || ''}
        driverInitials={driver?.initials || '?'}
      />

      <div className="p-6 space-y-6">
        {/* Back + Actions */}
        <div className="flex items-center justify-between">
          <Link href="/chauffeur/analyses">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Retour aux analyses
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              generateAnalysisPDF({
                driverName: driver?.name || "Inconnu",
                period: analysis.period,
                score: analysis.score,
                uploadDate: analysis.date,
                infractions: infractions.map(inf => ({
                  date: inf.date,
                  type: inf.type,
                  severity: inf.severity,
                })),
              })
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <ScoreGauge score={analysis.score} size="sm" />
              <div>
                <p className="text-2xl font-bold text-foreground">{analysis.score}/100</p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{infractions.length}</p>
                <p className="text-xs text-muted-foreground">Infractions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-danger/10 p-2.5">
                <Euro className="h-5 w-5 text-danger" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalCost.toLocaleString()}€</p>
                <p className="text-xs text-muted-foreground">Amendes potentielles</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{analysis.period.split(' - ')[0]}</p>
                <p className="text-xs text-muted-foreground">au {analysis.period.split(' - ')[1]}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Severity breakdown */}
        {infractions.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {graveCounts > 0 && (
              <Badge variant="outline" className="text-danger border-danger/30 bg-danger/5 px-3 py-1">
                {graveCounts} infraction{graveCounts > 1 ? 's' : ''} grave{graveCounts > 1 ? 's' : ''}
              </Badge>
            )}
            {mineurCounts > 0 && (
              <Badge variant="outline" className="text-blue-600 border-blue-600/30 bg-blue-600/5 px-3 py-1">
                {mineurCounts} infraction{mineurCounts > 1 ? 's' : ''} mineure{mineurCounts > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}

        {/* Infractions by date */}
        {infractions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="mx-auto h-10 w-10 text-success" />
              <p className="mt-4 font-medium text-foreground">Aucune infraction sur cette analyse</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Infractions par journée</h3>
            {Object.entries(byDate).map(([dateKey, dayInfractions]) => (
              <Card key={dateKey}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">
                      {new Date(dateKey).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </CardTitle>
                    <Badge variant="secondary">{dayInfractions.length} infraction{dayInfractions.length > 1 ? 's' : ''}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayInfractions.map((inf) => {
                    const gravity = severityToGravity(inf.severity)
                    const advice = adviceMap[inf.type] || "Respectez les temps de conduite et de repos réglementaires (CE 561/2006)."

                    return (
                      <div key={inf.id} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                            <span className="text-sm font-medium text-foreground">{inf.type}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <GravityBadge gravity={gravity} />
                            <Badge variant="secondary" className="text-danger font-mono">
                              {severityCosts[inf.severity] || 90}€
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-md bg-primary/5 p-2">
                          <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">{advice}</p>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
