"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DriverHeader } from "@/components/driver/driver-header"
import { ScoreGauge } from "@/components/analysis/score-gauge"
import { generateAnalysisPDF } from "@/lib/generate-pdf"
import { Calendar, Download, Eye, ChevronRight, Loader2, AlertTriangle, FileText } from "lucide-react"

export default function DriverAnalysesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analyses, setAnalyses] = useState<any[]>([])
  const [driver, setDriver] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const meRes = await fetch('/api/chauffeur/me', { credentials: 'include' })
        const meData = await meRes.json()

        if (!meData.driver) {
          if (meRes.status === 401) router.push('/login')
          setLoading(false)
          return
        }

        setDriver(meData.driver)

        // Fetch full analyses for this driver (includes infractions severity)
        const analysesRes = await fetch(`/api/analyses?driverId=${meData.driver.id}`, { credentials: 'include' })
        const analysesData = await analysesRes.json()
        const list: any[] = analysesData.analyses || []

        setAnalyses(list.map((a: any) => {
          const infrList = a.infractions || []
          return {
            ...a,
            period: `${new Date(a.periodStart).toLocaleDateString('fr-FR')} - ${new Date(a.periodEnd).toLocaleDateString('fr-FR')}`,
            date: new Date(a.uploadDate).toLocaleDateString('fr-FR'),
            infractionCount: infrList.length,
            severityCounts: {
              serious: infrList.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length,
              minor: infrList.filter((i: any) => i.severity === 'medium' || i.severity === 'low').length,
            },
          }
        }))
      } catch (error) {
        console.error('Error loading analyses:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const totalAnalyses = analyses.length
  const avgScore = totalAnalyses > 0 ? Math.round(analyses.reduce((s, a) => s + (a.score || 0), 0) / totalAnalyses) : 0
  const totalInfractions = analyses.reduce((s, a) => s + a.infractionCount, 0)

  return (
    <div className="min-h-screen bg-background">
      <DriverHeader
        title="Mes analyses"
        subtitle="Consultez l'historique de vos analyses tachygraphe"
        driverName={driver?.name || ''}
        driverInitials={driver?.initials || '?'}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalAnalyses}</p>
                <p className="text-sm text-muted-foreground">Analyse{totalAnalyses > 1 ? 's' : ''}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <ScoreGauge score={avgScore} size="sm" />
              <div>
                <p className="text-2xl font-bold text-foreground">{avgScore}/100</p>
                <p className="text-sm text-muted-foreground">Score moyen</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalInfractions}</p>
                <p className="text-sm text-muted-foreground">Infraction{totalInfractions > 1 ? 's' : ''} totales</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analyses List */}
        <div className="space-y-4">
          {analyses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-4 font-medium text-foreground">Aucune analyse disponible</p>
                <p className="mt-1 text-sm text-muted-foreground">Vos analyses apparaîtront ici une fois créées par votre entreprise</p>
              </CardContent>
            </Card>
          ) : (
            analyses.map((analysis) => (
              <Card key={analysis.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-shrink-0">
                      <ScoreGauge score={analysis.score} size="sm" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{analysis.period}</span>
                        <Badge variant="outline" className="text-xs">Analysé le {analysis.date}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">{analysis.infractionCount}</span> infraction{analysis.infractionCount > 1 ? 's' : ''}
                        </span>
                        {analysis.severityCounts.minor > 0 && (
                          <span className="text-blue-600">{analysis.severityCounts.minor} mineure{analysis.severityCounts.minor > 1 ? 's' : ''}</span>
                        )}
                        {analysis.severityCounts.serious > 0 && (
                          <span className="text-danger">{analysis.severityCounts.serious} grave{analysis.severityCounts.serious > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const infRes = await fetch(`/api/infractions?analysisId=${analysis.id}`, { credentials: 'include' })
                          const infData = await infRes.json()
                          generateAnalysisPDF({
                            driverName: driver?.name || "Inconnu",
                            period: analysis.period,
                            score: analysis.score,
                            uploadDate: analysis.date,
                            infractions: (infData || []).map((inf: any) => ({
                              date: inf.date,
                              type: inf.type,
                              severity: inf.severity,
                            })),
                          })
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Link href={`/chauffeur/analyses/${analysis.id}`}>
                        <Button size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Détails
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
