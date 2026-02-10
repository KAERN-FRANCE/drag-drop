"use client"

import { useState } from "react"
import { Search, TrendingUp, TrendingDown, MoreHorizontal, Eye, FileSearch, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { getUserCompanyId } from "@/lib/company"
import { useEffect } from "react"

interface Driver {
  id: number
  name: string
  initials: string
  score: number
  status: string
  infractions: { count: number }[]
  created_at: string
}



function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return "text-success"
    if (s >= 70) return "text-warning"
    return "text-danger"
  }

  const getBackgroundColor = (s: number) => {
    if (s >= 90) return "bg-success"
    if (s >= 70) return "bg-warning"
    return "bg-danger"
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", getBackgroundColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("font-mono text-sm font-medium", getColor(score))}>{score}</span>
    </div>
  )
}

export function DriversTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("month")
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDrivers = async () => {
      const companyId = await getUserCompanyId()

      // Période réglementaire : 12 derniers mois
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const dateLimit = twelveMonthsAgo.toISOString().split('T')[0]

      let driversQuery = supabase.from("drivers").select("*")
      if (companyId) driversQuery = driversQuery.eq('company_id', companyId)
      const { data, error } = await driversQuery

      if (error) {
        console.error("Error fetching drivers:", error)
      } else if (data) {
        // Récupérer les infractions des 12 derniers mois
        let infQuery = supabase.from("infractions").select("driver_id, severity").gte('date', dateLimit)
        if (companyId) infQuery = infQuery.eq('company_id', companyId)
        const { data: infractions } = await infQuery

        const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }

        const formattedDrivers = data.map((driver: any) => {
          const driverInf = (infractions || []).filter((inf: any) => inf.driver_id === driver.id)
          let score = 100
          driverInf.forEach((inf: any) => { score -= penalites[inf.severity] || 5 })
          score = Math.max(0, Math.min(100, score))

          return {
            ...driver,
            score,
            infractions: driverInf.length,
            trend: score >= 80 ? "up" : score < 60 ? "down" : "stable",
            lastAnalysis: new Date(driver.updated_at).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long' }),
          }
        })
        setDrivers(formattedDrivers)
      }
      setLoading(false)
    }

    fetchDrivers()
  }, [])

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch = driver.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "risk" && driver.score < 70) ||
      (statusFilter === "compliant" && driver.score >= 90)
    return matchesSearch && matchesStatus
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Vue d'ensemble de la flotte <span className="text-xs font-normal text-muted-foreground">(12 derniers mois)</span></CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un chauffeur"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="risk">À risque</SelectItem>
              <SelectItem value="compliant">Conformes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="lastMonth">Mois dernier</SelectItem>
              <SelectItem value="quarter">3 derniers mois</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Infractions</TableHead>
                <TableHead>Tendance</TableHead>
                <TableHead>Dernière analyse</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.map((driver) => (
                <TableRow key={driver.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {driver.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{driver.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ScoreGauge score={driver.score} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={driver.infractions > 5 ? "destructive" : "secondary"} className="font-mono">
                      {driver.infractions}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {driver.trend === "up" && <TrendingUp className="h-4 w-4 text-success" />}
                    {driver.trend === "down" && <TrendingDown className="h-4 w-4 text-danger" />}
                    {driver.trend === "stable" && <div className="h-0.5 w-4 bg-muted-foreground" />}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{driver.lastAnalysis}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir détails
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileSearch className="mr-2 h-4 w-4" />
                          Analyses
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          Exporter
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredDrivers.length} chauffeurs</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Précédent
            </Button>
            <Button variant="outline" size="sm">
              Suivant
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
