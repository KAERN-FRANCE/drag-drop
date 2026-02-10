"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Search, Plus, MoreHorizontal, Eye, FileSearch, Edit, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { getUserCompanyId } from "@/lib/company"
import { AddDriverModal } from "@/components/drivers/add-driver-modal"
import { EditDriverModal } from "@/components/drivers/edit-driver-modal"

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
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", getBackgroundColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className={cn("text-center font-mono text-sm font-medium", getColor(score))}>{score}/100</p>
    </div>
  )
}

export default function DriversListPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editDriver, setEditDriver] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDrivers = async () => {
    const companyId = await getUserCompanyId()

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const dateLimit = twelveMonthsAgo.toISOString().split('T')[0]

    let query = supabase.from("drivers").select("*")
    if (companyId) query = query.eq('company_id', companyId)
    const { data, error } = await query

    if (error) {
      console.error("Error fetching drivers:", error)
      setLoading(false)
      return
    }

    if (data) {
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
          lastAnalysis: new Date(driver.updated_at).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long' }),
        }
      })
      setDrivers(formattedDrivers)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDrivers()
  }, [])

  const deleteDriver = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-driver', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: deleteId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setDrivers(prev => prev.filter(d => d.id !== deleteId))
    } catch (err: any) {
      console.error('Erreur suppression:', err)
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch = driver.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "risk" && driver.score < 70) ||
      (statusFilter === "compliant" && driver.score >= 90)
    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Chauffeurs" />
        <main className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Gestion des chauffeurs</h1>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un chauffeur
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom"
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
              <Badge variant="secondary" className="px-3 py-1">
                {filteredDrivers.length} chauffeur{filteredDrivers.length > 1 ? 's' : ''}
              </Badge>
            </div>

            {/* Drivers Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDrivers.map((driver) => (
                <Card key={driver.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">{driver.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{driver.name}</h3>
                          <Badge
                            variant={driver.status === "active" ? "default" : "secondary"}
                            className={cn(
                              "mt-1",
                              driver.status === "active" && "bg-success/20 text-success hover:bg-success/30",
                            )}
                          >
                            {driver.status === "active" ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/chauffeurs/${driver.id}`}>
                            <DropdownMenuItem>
                              <FileSearch className="mr-2 h-4 w-4" />
                              Voir analyses
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem onClick={() => setEditDriver(driver)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(driver.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div>
                        <p className="mb-2 text-sm text-muted-foreground">Score (12 mois) :</p>
                        <ScoreGauge score={driver.score} />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Infractions (12 mois) :</span>
                        <Badge variant={driver.infractions > 5 ? "destructive" : "secondary"} className="font-mono">
                          {driver.infractions}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Dernière mise à jour :</span>
                        <span className="text-foreground">{driver.lastAnalysis}</span>
                      </div>
                    </div>

                    <Link href={`/chauffeurs/${driver.id}`}>
                      <Button variant="outline" className="mt-6 w-full bg-transparent">
                        <Eye className="mr-2 h-4 w-4" />
                        Voir le profil
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
        <AddDriverModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          onDriverAdded={() => fetchDrivers()}
        />
        <EditDriverModal
          open={editDriver !== null}
          onOpenChange={(open) => { if (!open) setEditDriver(null) }}
          driver={editDriver}
          onDriverUpdated={() => fetchDrivers()}
        />
        <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce chauffeur ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Toutes les analyses et infractions associées seront également supprimées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <Button variant="destructive" onClick={deleteDriver} disabled={deleting}>
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Supprimer
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
