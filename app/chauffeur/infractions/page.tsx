"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DriverHeader } from "@/components/driver/driver-header"
import { GravityBadge } from "@/components/analysis/gravity-badge"
import { Search, Filter, AlertTriangle, Calendar, Lightbulb, ChevronDown, ChevronUp, Loader2, Euro } from "lucide-react"
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

export default function DriverInfractionsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [gravityFilter, setGravityFilter] = useState("all")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [infractions, setInfractions] = useState<any[]>([])
  const [driver, setDriver] = useState<any>(null)

  useEffect(() => {
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

        // 3 derniers mois
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        const dateLimit = threeMonthsAgo.toISOString().split('T')[0]

        const { data: infData } = await supabase
          .from('infractions')
          .select('*')
          .eq('driver_id', driverData.id)
          .gte('date', dateLimit)
          .order('date', { ascending: false })

        if (infData) setInfractions(infData)
      } catch (error) {
        console.error('Error loading infractions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  const filteredInfractions = infractions.filter((inf) => {
    const matchesSearch = inf.type.toLowerCase().includes(searchQuery.toLowerCase())
    const gravity = severityToGravity(inf.severity)
    const matchesGravity = gravityFilter === "all" || gravity === gravityFilter
    return matchesSearch && matchesGravity
  })

  // Stats
  const totalFines = infractions.reduce((sum, inf) => sum + (severityCosts[inf.severity] || 90), 0)
  const byGravity = {
    "3eme": infractions.filter(i => severityToGravity(i.severity) === "3eme").length,
    "4eme": infractions.filter(i => severityToGravity(i.severity) === "4eme").length,
    "5eme": infractions.filter(i => severityToGravity(i.severity) === "5eme").length,
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DriverHeader
        title="Mes infractions"
        subtitle="Suivi sur les 3 derniers mois"
        driverName={driver?.name || ''}
        driverInitials={driver?.initials || '?'}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{infractions.length}</p>
                <p className="text-xs text-muted-foreground">Infractions (3 mois)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-danger/10 p-2.5">
                <Euro className="h-5 w-5 text-danger" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalFines.toLocaleString()}€</p>
                <p className="text-xs text-muted-foreground">Amendes potentielles</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Répartition par gravité</p>
              <div className="flex gap-3 flex-wrap">
                {byGravity["3eme"] > 0 && (
                  <div className="flex items-center gap-1.5"><GravityBadge gravity="3eme" /><span className="text-sm font-mono">{byGravity["3eme"]}</span></div>
                )}
                {byGravity["4eme"] > 0 && (
                  <div className="flex items-center gap-1.5"><GravityBadge gravity="4eme" /><span className="text-sm font-mono">{byGravity["4eme"]}</span></div>
                )}
                {byGravity["5eme"] > 0 && (
                  <div className="flex items-center gap-1.5"><GravityBadge gravity="5eme" /><span className="text-sm font-mono">{byGravity["5eme"]}</span></div>
                )}
                {infractions.length === 0 && <span className="text-sm text-muted-foreground">Aucune infraction</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Select value={gravityFilter} onValueChange={setGravityFilter}>
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Gravité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="3eme">3ème classe</SelectItem>
              <SelectItem value="4eme">4ème classe</SelectItem>
              <SelectItem value="5eme">5ème classe</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{filteredInfractions.length} résultat{filteredInfractions.length > 1 ? 's' : ''}</Badge>
        </div>

        {/* Infractions List */}
        <div className="space-y-2">
          {filteredInfractions.map((inf) => {
            const isExpanded = expandedId === inf.id
            const gravity = severityToGravity(inf.severity)
            const advice = adviceMap[inf.type] || "Respectez les temps de conduite et de repos réglementaires (CE 561/2006)."

            return (
              <Card key={inf.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : inf.id)}
                    className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {new Date(inf.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <GravityBadge gravity={gravity} />
                        </div>
                        <p className="mt-1 font-medium text-foreground text-sm">{inf.type}</p>
                      </div>
                      <Badge variant="secondary" className="text-danger font-mono">
                        {severityCosts[inf.severity] || 90}€
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Lightbulb className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">Conseil</p>
                          <p className="mt-1 text-sm text-muted-foreground">{advice}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {filteredInfractions.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                {infractions.length === 0 ? (
                  <>
                    <Calendar className="mx-auto h-10 w-10 text-success" />
                    <p className="mt-4 font-medium text-foreground">Aucune infraction sur les 3 derniers mois !</p>
                  </>
                ) : (
                  <>
                    <Search className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-4 font-medium text-foreground">Aucun résultat</p>
                    <p className="mt-1 text-sm text-muted-foreground">Modifiez vos filtres pour voir plus de résultats</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
