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
import { Search, Plus, MoreHorizontal, Eye, EyeOff, RotateCcw, FileSearch, Edit, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddDriverModal } from "@/components/drivers/add-driver-modal"
import { EditDriverModal } from "@/components/drivers/edit-driver-modal"

function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => s >= 90 ? "text-success" : s >= 70 ? "text-warning" : "text-danger"
  const getBg    = (s: number) => s >= 90 ? "bg-success"   : s >= 70 ? "bg-warning"   : "bg-danger"
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", getBg(score))} style={{ width: `${score}%` }} />
      </div>
      <p className={cn("text-center font-mono text-sm font-medium", getColor(score))}>{score}/100</p>
    </div>
  )
}

export default function DriversListPage() {
  const [searchQuery,   setSearchQuery]   = useState("")
  const [statusFilter,  setStatusFilter]  = useState("all")
  const [drivers,       setDrivers]       = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [editDriver,    setEditDriver]    = useState<any>(null)
  const [deleteId,      setDeleteId]      = useState<number | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [showHidden,    setShowHidden]    = useState(false)

  const fetchDrivers = async (includeHidden = false) => {
    const dateLimit = new Date()
    dateLimit.setMonth(dateLimit.getMonth() - 12)
    const dateLimitStr = dateLimit.toISOString().split('T')[0]

    const driverUrl = includeHidden ? '/api/drivers?includeHidden=true' : '/api/drivers'
    const [driversRes, infRes] = await Promise.all([
      fetch(driverUrl, { credentials: 'include' }),
      fetch(`/api/infractions?dateFrom=${dateLimitStr}`, { credentials: 'include' }),
    ])

    const driversData = await driversRes.json()
    const infList: any[] = await infRes.json()
    const driversList: any[] = driversData.drivers || []

    const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }
    const formatted = driversList.map(driver => {
      const driverInf = infList.filter(inf => inf.driverId === driver.id)
      let score = 100
      driverInf.forEach(inf => { score -= penalites[inf.severity] || 5 })
      score = Math.max(0, Math.min(100, score))
      return {
        ...driver,
        score,
        infractions: driverInf.length,
        lastAnalysis: driver.updatedAt ? new Date(driver.updatedAt).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long' }) : '—',
      }
    })
    setDrivers(formatted)
    setLoading(false)
  }

  useEffect(() => { fetchDrivers(showHidden) }, [showHidden])

  const toggleDriverStatus = async (driverId: number, newStatus: 'active' | 'inactive') => {
    try {
      const res = await fetch(`/api/drivers/${driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Erreur')
      fetchDrivers(showHidden)
    } catch (err) {
      console.error('Erreur changement statut:', err)
    }
  }

  const deleteDriver = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-driver', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  const filteredDrivers = drivers.filter(driver => {
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
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">Gestion des chauffeurs</h1>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un chauffeur
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Rechercher par nom" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="risk">À risque</SelectItem>
                  <SelectItem value="compliant">Conformes</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                  className="rounded border-border"
                />
                <EyeOff className="h-3.5 w-3.5" />
                Afficher les masqués
              </label>
              <Badge variant="secondary" className="px-3 py-1">
                {filteredDrivers.length} chauffeur{filteredDrivers.length > 1 ? 's' : ''}
              </Badge>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDrivers.map((driver) => (
                  <Card key={driver.id} className={cn("transition-shadow hover:shadow-md", driver.status === 'inactive' && "opacity-60")}>
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
                              className={cn("mt-1",
                                driver.status === "active" && "bg-success/20 text-success hover:bg-success/30",
                                driver.status === "inactive" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {driver.status === "active" ? "Actif" : "Masqué"}
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
                                <FileSearch className="mr-2 h-4 w-4" />Voir analyses
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem onClick={() => setEditDriver(driver)}>
                              <Edit className="mr-2 h-4 w-4" />Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {driver.status === 'active' ? (
                              <DropdownMenuItem onClick={() => toggleDriverStatus(driver.id, 'inactive')}>
                                <EyeOff className="mr-2 h-4 w-4" />Masquer le conducteur
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => toggleDriverStatus(driver.id, 'active')}>
                                <RotateCcw className="mr-2 h-4 w-4" />Réactiver le conducteur
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(driver.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />Supprimer
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
                          <Eye className="mr-2 h-4 w-4" />Voir le profil
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
        <AddDriverModal open={showAddModal} onOpenChange={setShowAddModal} onDriverAdded={() => fetchDrivers()} />
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
