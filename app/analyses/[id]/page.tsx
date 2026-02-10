"use client"

import { ChevronRight, FileDown, AlertTriangle, Loader2 } from "lucide-react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUserCompanyId } from "@/lib/company"
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

export default function AnalysisDetailPage() {
  const params = useParams()
  const id = params.id
  const [activeTab, setActiveTab] = useState("overview")
  const [analysis, setAnalysis] = useState<any>(null)
  const [infractions, setInfractions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchAnalysis = async () => {
      const companyId = await getUserCompanyId()
      let analysisQuery = supabase
        .from('analyses')
        .select('*, drivers(name, id)')
        .eq('id', id)
      if (companyId) analysisQuery = analysisQuery.eq('company_id', companyId)
      const { data: analysisData } = await analysisQuery.single()

      if (analysisData) {
        setAnalysis({
          ...analysisData,
          driverName: analysisData.drivers?.name,
          driverId: analysisData.drivers?.id || analysisData.driver_id,
          period: `${new Date(analysisData.period_start).toLocaleDateString('fr-FR', { month: 'short' })}-${new Date(analysisData.period_end).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`,
        })

        const { data: infData } = await supabase
          .from('infractions')
          .select('*')
          .eq('analysis_id', id)

        if (infData) {
          setInfractions(infData)
        }
      }
      setLoading(false)
    }
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

  // Calcul dynamique du coût potentiel
  let totalCost = 0
  let criticalCount = 0
  infractions.forEach(inf => {
    if (inf.severity === 'critical') { totalCost += 1500; criticalCount++ }
    else if (inf.severity === 'high') { totalCost += 750; criticalCount++ }
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
            {/* Breadcrumb & Actions */}
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
                      uploadDate: new Date(analysis.upload_date).toLocaleDateString("fr-FR"),
                      infractions: infractions.map(inf => ({
                        date: inf.date,
                        type: inf.type,
                        severity: inf.severity,
                      })),
                    })
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>

            {/* Alert - dynamique */}
            {infractions.length > 0 && (
              <Alert className="border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning-foreground">
                  <strong>{infractions.length} infraction{infractions.length > 1 ? 's' : ''} détectée{infractions.length > 1 ? 's' : ''}</strong> sur cette analyse.
                  {totalCost > 0 && <> Le coût potentiel en cas de contrôle s'élève à <strong>{totalCost.toLocaleString()}€</strong>.</>}
                </AlertDescription>
              </Alert>
            )}

            {/* Summary Cards */}
            <AnalysisSummary
              score={analysis.score}
              infractions={infractions.length}
              period={analysis.period}
              cost={totalCost}
            />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="daily">Par journée ({new Set(infractions.map(i => i.date)).size})</TabsTrigger>
                <TabsTrigger value="weekly">Par semaine</TabsTrigger>
                <TabsTrigger value="recommendations">Recommandations</TabsTrigger>
              </TabsList>
              <div className="mt-6">
                <TabsContent value="overview">
                  <OverviewTab infractions={infractions} />
                </TabsContent>
                <TabsContent value="daily">
                  <DailyTab infractions={infractions} />
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
