"use client"

import Link from "next/link"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { ScoreGauge } from "@/components/analysis/score-gauge"
import { GravityBadge } from "@/components/analysis/gravity-badge"
import { EditDriverModal } from "@/components/drivers/edit-driver-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ChevronRight, Edit, FileText, Mail, Phone, Calendar, Award,
  AlertTriangle, Eye, ShieldCheck, TrendingUp,
} from "lucide-react"

const tooltipStyle = { backgroundColor: "#1e293b", border: "none", borderRadius: "8px", padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }
const tooltipLabelStyle = { color: "#e2e8f0", fontWeight: 600, fontSize: 13, marginBottom: 4 }
const tooltipItemStyle  = { color: "#94a3b8", fontSize: 12 }

export default function DriverDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [driver,                setDriver]                = useState<any>(null)
  const [infractions,           setInfractions]           = useState<any[]>([])
  const [allInfractions12m,     setAllInfractions12m]     = useState<any[]>([])
  const [analyses,              setAnalyses]              = useState<any[]>([])
  const [evolutionData,         setEvolutionData]         = useState<any[]>([])
  const [loading,               setLoading]               = useState(true)
  const [driverScore,           setDriverScore]           = useState(100)
  const [companyAvg,            setCompanyAvg]            = useState(100)
  const [ranking,               setRanking]               = useState({ position: 0, total: 0 })
  const [daysSinceLastInfraction, setDaysSinceLastInfraction] = useState<number | null>(null)
  const [showEditModal,         setShowEditModal]         = useState(false)
  const [severityBreakdown,     setSeverityBreakdown]     = useState({ critical: 0, high: 0, medium: 0, low: 0 })

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      const dateLimit = new Date()
      dateLimit.setMonth(dateLimit.getMonth() - 12)
      const dateLimitStr = dateLimit.toISOString().split('T')[0]

      const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }

      const [driverRes, allDriversRes, allInfRes, driverInfRes, analysesRes] = await Promise.all([
        fetch(`/api/drivers/${id}`, { credentials: 'include' }),
        fetch('/api/drivers', { credentials: 'include' }),
        fetch(`/api/infractions?dateFrom=${dateLimitStr}`, { credentials: 'include' }),
        fetch(`/api/infractions?driverId=${id}&dateFrom=${dateLimitStr}`, { credentials: 'include' }),
        fetch(`/api/analyses?driverId=${id}`, { credentials: 'include' }),
      ])

      const driverData = await driverRes.json()
      if (!driverData || driverData.error) { setLoading(false); return }
      setDriver(driverData)

      const allDrivers: any[] = (await allDriversRes.json()).drivers || []
      const allInf:    any[] = await allInfRes.json()

      // Ranking
      const scores = allDrivers.map(d => {
        const dInf = allInf.filter(inf => inf.driver_id === d.id)
        let score = 100
        dInf.forEach(inf => { score -= penalites[inf.severity] || 5 })
        return { id: d.id, score: Math.max(0, Math.min(100, score)) }
      })
      const currentScore = scores.find(s => s.id === Number(id))?.score || 100
      setDriverScore(currentScore)
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 100
      setCompanyAvg(avg)
      const sorted = [...scores].sort((a, b) => b.score - a.score)
      setRanking({ position: sorted.findIndex(s => s.id === Number(id)) + 1, total: sorted.length })

      // Driver's own infractions
      const driverInf12m: any[] = await driverInfRes.json()
      setAllInfractions12m(driverInf12m)

      const breakdown = { critical: 0, high: 0, medium: 0, low: 0 }
      driverInf12m.forEach(inf => {
        const sev = inf.severity as keyof typeof breakdown
        if (breakdown[sev] !== undefined) breakdown[sev]++
      })
      setSeverityBreakdown(breakdown)

      if (driverInf12m.length > 0) {
        const lastDate = new Date(driverInf12m[0].date)
        setDaysSinceLastInfraction(Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)))
      } else {
        setDaysSinceLastInfraction(null)
      }

      setInfractions(driverInf12m.slice(0, 5).map(inf => ({
        ...inf,
        date: new Date(inf.date).toLocaleDateString('fr-FR'),
        gravity: inf.severity === 'critical' ? '5eme' : inf.severity === 'high' ? '4eme' : '3eme',
      })))

      // Analyses
      const analysesData = await analysesRes.json()
      const anaList: any[] = analysesData.analyses || []
      const analysesWithCounts = anaList.map(a => ({
        ...a,
        date: new Date(a.upload_date).toLocaleDateString('fr-FR'),
        period: `${new Date(a.period_start).toLocaleDateString('fr-FR', { month: 'short' })} - ${new Date(a.period_end).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`,
        infractions: a.infractions?.length || 0,
      }))
      setAnalyses(analysesWithCounts)
      setEvolutionData(anaList.map(a => ({
        month: new Date(a.period_end).toLocaleDateString('fr-FR', { month: 'short' }),
        score: a.score,
      })).reverse())

      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )

  if (!driver) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Chauffeur non trouvé</p>
    </div>
  )

  const severityConfig = [
    { key: "critical", label: "Critiques", color: "#ef4444" },
    { key: "high",     label: "Majeures",  color: "#f97316" },
    { key: "medium",   label: "Moyennes",  color: "#eab308" },
    { key: "low",      label: "Mineures",  color: "#22c55e" },
  ]
  const totalInf = allInfractions12m.length

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Chauffeurs" />
        <main className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/chauffeurs" className="hover:text-foreground">Chauffeurs</Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground">{driver.name}</span>
            </div>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="analyses">Analyses ({analyses.length})</TabsTrigger>
                <TabsTrigger value="infractions">Infractions ({totalInf})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-6">
                      <Avatar className="h-20 w-20">
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl">{driver.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h1 className="text-2xl font-bold text-foreground">{driver.name}</h1>
                            <Badge className={cn("mt-2", driver.status === "active" ? "bg-success/20 text-success hover:bg-success/30" : "bg-muted text-muted-foreground")}>
                              {driver.status === "active" ? "Actif" : "Inactif"}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                              <Edit className="mr-2 h-4 w-4" />Modifier
                            </Button>
                            <Link href="/analyses">
                              <Button size="sm"><FileText className="mr-2 h-4 w-4" />Voir les analyses</Button>
                            </Link>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
                          {driver.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4" />{driver.email}</div>}
                          {driver.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{driver.phone}</div>}
                          {driver.created_at && <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Depuis le {new Date(driver.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-4">
                  <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{driverScore}/100</p><p className="text-xs text-muted-foreground">Score (12 mois)</p></div></div></CardContent></Card>
                  <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-lg bg-warning/10 p-2"><AlertTriangle className="h-5 w-5 text-warning" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{totalInf}</p><p className="text-xs text-muted-foreground">Infractions (12 mois)</p></div></div></CardContent></Card>
                  <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-lg bg-success/10 p-2"><Award className="h-5 w-5 text-success" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{ranking.position}/{ranking.total}</p><p className="text-xs text-muted-foreground">Classement entreprise</p></div></div></CardContent></Card>
                  <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{daysSinceLastInfraction !== null ? `${daysSinceLastInfraction}j` : "—"}</p><p className="text-xs text-muted-foreground">Depuis dernière infraction</p></div></div></CardContent></Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Évolution du score</CardTitle></CardHeader>
                      <CardContent>
                        {evolutionData.length === 0 ? (
                          <div className="flex items-center justify-center h-[220px]"><p className="text-sm text-muted-foreground">Pas encore d'analyses</p></div>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height={220}>
                              <AreaChart data={evolutionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                <defs><linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorScore)" name="Score" dot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                              <div className="h-px w-6 bg-muted-foreground/30" />
                              <span>Moyenne entreprise : {companyAvg}/100</span>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Répartition par gravité (12 mois)</CardTitle></CardHeader>
                      <CardContent>
                        {totalInf === 0 ? (
                          <div className="flex items-center justify-center h-[160px]"><p className="text-sm text-muted-foreground">Aucune infraction</p></div>
                        ) : (
                          <div className="space-y-3">
                            {severityConfig.map(s => {
                              const count = severityBreakdown[s.key as keyof typeof severityBreakdown]
                              const pct = totalInf > 0 ? (count / totalInf) * 100 : 0
                              return (
                                <div key={s.key} className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                      <span className="text-sm text-foreground">{s.label}</span>
                                    </div>
                                    <span className="text-sm font-semibold tabular-nums text-foreground">{count} <span className="text-xs font-normal text-muted-foreground">({Math.round(pct)}%)</span></span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-muted">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Dernières infractions</CardTitle></CardHeader>
                      <CardContent>
                        {infractions.length === 0 ? (
                          <div className="flex items-center justify-center h-[120px]"><p className="text-sm text-muted-foreground">Aucune infraction récente</p></div>
                        ) : (
                          <div className="relative space-y-4 pl-6">
                            <div className="absolute left-2 top-2 h-[calc(100%-16px)] w-0.5 bg-border" />
                            {infractions.map((infraction, index) => (
                              <div key={index} className="relative">
                                <div className={cn("absolute -left-4 top-1.5 h-3 w-3 rounded-full border-2 bg-card", infraction.severity === 'critical' ? "border-danger" : infraction.severity === 'high' ? "border-warning" : "border-muted-foreground")} />
                                <div className="rounded-lg border border-border p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{infraction.date}</span>
                                    <span className="font-medium text-foreground text-sm">{infraction.type}</span>
                                    <GravityBadge gravity={infraction.gravity} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Analyses récentes</CardTitle></CardHeader>
                      <CardContent>
                        {analyses.length === 0 ? (
                          <div className="flex items-center justify-center h-[120px]"><p className="text-sm text-muted-foreground">Aucune analyse</p></div>
                        ) : (
                          <div className="space-y-3">
                            {analyses.slice(0, 5).map((analysis) => (
                              <div key={analysis.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{analysis.period}</p>
                                  <p className="text-xs text-muted-foreground">{analysis.date}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <p className={cn("font-mono text-sm font-semibold", analysis.score >= 80 ? "text-success" : analysis.score >= 60 ? "text-warning" : "text-danger")}>{analysis.score}/100</p>
                                  <Link href={`/analyses/${analysis.id}`}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analyses" className="mt-6">
                <Card><CardContent className="p-6">
                  {analyses.length === 0 ? (
                    <p className="text-center text-muted-foreground">Aucune analyse pour ce chauffeur</p>
                  ) : (
                    <div className="space-y-3">
                      {analyses.map((analysis) => (
                        <div key={analysis.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
                            <div>
                              <p className="font-medium text-foreground">{analysis.period}</p>
                              <p className="text-sm text-muted-foreground">Uploadé le {analysis.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className={cn("font-mono text-lg font-bold", analysis.score >= 80 ? "text-success" : analysis.score >= 60 ? "text-warning" : "text-danger")}>{analysis.score}/100</p>
                              <p className="text-xs text-muted-foreground">{analysis.infractions} infraction{analysis.infractions > 1 ? 's' : ''}</p>
                            </div>
                            <Link href={`/analyses/${analysis.id}`}>
                              <Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4" />Voir</Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="infractions" className="mt-6">
                <Card><CardContent className="p-6">
                  {allInfractions12m.length === 0 ? (
                    <p className="text-center text-muted-foreground">Aucune infraction sur les 12 derniers mois</p>
                  ) : (
                    <div className="space-y-3">
                      {allInfractions12m.map((inf, index) => (
                        <div key={inf.id || index} className="flex items-center justify-between rounded-lg border border-border p-4">
                          <div className="flex items-center gap-4">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", inf.severity === 'critical' ? "bg-danger/10" : inf.severity === 'high' ? "bg-warning/10" : "bg-muted")}>
                              <AlertTriangle className={cn("h-5 w-5", inf.severity === 'critical' ? "text-danger" : inf.severity === 'high' ? "text-warning" : "text-muted-foreground")} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{inf.type}</p>
                              <p className="text-sm text-muted-foreground">{new Date(inf.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                          </div>
                          <GravityBadge gravity={inf.severity === 'critical' ? '5eme' : inf.severity === 'high' ? '4eme' : '3eme'} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <EditDriverModal open={showEditModal} onOpenChange={setShowEditModal} driver={driver} onDriverUpdated={() => window.location.reload()} />
      </div>
    </div>
  )
}
