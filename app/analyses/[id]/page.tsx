"use client"

import { ChevronRight, FileDown, AlertTriangle, CalendarDays, Loader2 } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { generateAnalysisPDF } from "@/lib/generate-pdf"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { AnalysisSummary } from "@/components/analysis/analysis-summary"
import { OverviewTab } from "@/components/analysis/overview-tab"
import { DailyTab } from "@/components/analysis/daily-tab"
import { WeeklyTab } from "@/components/analysis/weekly-tab"
import { RecommendationsTab } from "@/components/analysis/recommendations-tab"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AnalysisDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id
  const [activeTab, setActiveTab] = useState("overview")
  const [analysis, setAnalysis] = useState<any>(null)
  const [infractions, setInfractions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPeriodDialog, setShowPeriodDialog] = useState(false)
  const [newPeriodStart, setNewPeriodStart] = useState("")
  const [newPeriodEnd, setNewPeriodEnd] = useState("")
  const [reanalyzing, setReanalyzing] = useState(false)
  const [hasRawData, setHasRawData] = useState(false)
  const [rawDataRange, setRawDataRange] = useState({ min: "", max: "" })
  const [dailyStats, setDailyStats] = useState<any[]>([])

  const fetchAnalysis = async () => {
    const res = await fetch(`/api/analyses/${id}`, { credentials: 'include' })
    const data = await res.json()

    if (data && !data.error) {
      setAnalysis({
        ...data,
        period: `${new Date(data.periodStart).toLocaleDateString('fr-FR', { month: 'short' })}-${new Date(data.periodEnd).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`,
      })
      setInfractions(data.infractions || [])
      setHasRawData(!!data.hasRawActivities)
      setDailyStats(data.dailyStats || [])
      if (data.rawDataRange) {
        setRawDataRange(data.rawDataRange)
      }
      setNewPeriodStart(data.periodStart)
      setNewPeriodEnd(data.periodEnd)
    }
    setLoading(false)
  }

  const reanalyze = async () => {
    setReanalyzing(true)
    try {
      const res = await fetch(`/api/analyses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ periodStart: newPeriodStart, periodEnd: newPeriodEnd }),
      })
      if (!res.ok) throw new Error('Erreur')
      setShowPeriodDialog(false)
      await fetchAnalysis()
    } catch (err) {
      console.error('Erreur re-analyse:', err)
    } finally {
      setReanalyzing(false)
    }
  }

  useEffect(() => {
    if (!id) return
    fetchAnalysis()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Analyse non trouvée</p>
      </div>
    )
  }

  let totalCost = 0
  infractions.forEach(inf => {
    if (inf.severity === 'critical') totalCost += 1500
    else if (inf.severity === 'high') totalCost += 750
    else if (inf.severity === 'medium') totalCost += 135
    else totalCost += 90
  })

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Analyses" />
        <main className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/analyses" className="hover:text-foreground">
                  Analyses
                </Link>
                <ChevronRight className="h-4 w-4" />
                <Link href={`/chauffeurs/${analysis.driverId}`} className="hover:text-foreground">
                  {analysis.driverName}
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">{analysis.period}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    generateAnalysisPDF({
                      driverName: analysis.driverName || "Inconnu",
                      period: analysis.period,
                      score: analysis.score,
                      uploadDate: new Date(analysis.uploadDate).toLocaleDateString("fr-FR"),
                      infractions: infractions.map(inf => ({
                        date: inf.date,
                        type: inf.type,
                        severity: inf.severity,
                        details: inf.details || null,
                      })),
                    })
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>

            {infractions.length > 0 && (
              <Alert className="border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning-foreground">
                  <strong>{infractions.length} infraction{infractions.length > 1 ? 's' : ''} détectée{infractions.length > 1 ? 's' : ''}</strong> sur cette analyse.
                  {totalCost > 0 && <> Le coût potentiel en cas de contrôle s'élève à <strong>{totalCost.toLocaleString()}€</strong>.</>}
                </AlertDescription>
              </Alert>
            )}

            <AnalysisSummary
              score={analysis.score}
              infractions={infractions.length}
              period={analysis.period}
              cost={totalCost}
              onPeriodClick={hasRawData ? () => setShowPeriodDialog(true) : undefined}
            />

            {/* Dialog modification de période */}
            <Dialog open={showPeriodDialog} onOpenChange={setShowPeriodDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Modifier la période d'analyse</DialogTitle>
                  <DialogDescription>
                    Choisissez une nouvelle période pour re-analyser les données du fichier.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de début</label>
                    <input
                      type="date"
                      value={newPeriodStart}
                      onChange={(e) => setNewPeriodStart(e.target.value)}
                      min={rawDataRange.min || undefined}
                      max={newPeriodEnd || rawDataRange.max || undefined}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date de fin</label>
                    <input
                      type="date"
                      value={newPeriodEnd}
                      onChange={(e) => setNewPeriodEnd(e.target.value)}
                      min={newPeriodStart || rawDataRange.min || undefined}
                      max={rawDataRange.max || undefined}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  {rawDataRange.min && (
                    <p className="text-xs text-muted-foreground">
                      Données disponibles : {new Date(rawDataRange.min).toLocaleDateString('fr-FR')} — {new Date(rawDataRange.max).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPeriodDialog(false)} disabled={reanalyzing}>
                    Annuler
                  </Button>
                  <Button onClick={reanalyze} disabled={reanalyzing || !newPeriodStart || !newPeriodEnd}>
                    {reanalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Re-analyser
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full h-12 bg-muted/60 p-1 rounded-xl gap-1">
                <TabsTrigger value="overview" className="flex-1 h-full rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="daily" className="flex-1 h-full rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Par journée ({new Set(infractions.map(i => i.date)).size})</TabsTrigger>
                <TabsTrigger value="weekly" className="flex-1 h-full rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Par semaine</TabsTrigger>
                <TabsTrigger value="recommendations" className="flex-1 h-full rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Recommandations</TabsTrigger>
              </TabsList>
              <div className="mt-6">
                <TabsContent value="overview">
                  <OverviewTab infractions={infractions} />
                </TabsContent>
                <TabsContent value="daily">
                  <DailyTab infractions={infractions} dailyStats={dailyStats} />
                </TabsContent>
                <TabsContent value="weekly">
                  <WeeklyTab infractions={infractions} />
                </TabsContent>
                <TabsContent value="recommendations">
                  <RecommendationsTab />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
