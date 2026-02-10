"use client"

import { useState } from "react"
import Link from "next/link"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Search, Filter, FileText, MoreHorizontal, Eye, Download, Trash2, Upload, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { getUserCompanyId } from "@/lib/company"
import { generateAnalysisPDF } from "@/lib/generate-pdf"
import { useEffect } from "react"



function getScoreColor(score: number): string {
  if (score >= 80) return "text-success"
  if (score >= 60) return "text-warning"
  return "text-danger"
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-success/10"
  if (score >= 60) return "bg-warning/10"
  return "bg-danger/10"
}

export default function AnalysesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [analyses, setAnalyses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        const companyId = await getUserCompanyId()
        let query = supabase
          .from('analyses')
          .select('*, drivers(name), infractions(severity)')
          .order('upload_date', { ascending: false })
        if (companyId) query = query.eq('company_id', companyId)
        const { data, error } = await query

        if (data) {
          setAnalyses(data.map((a: any) => {
            const infractionsList = a.infractions || []
            const counts = {
              critical: infractionsList.filter((i: any) => i.severity === 'critical').length,
              major: infractionsList.filter((i: any) => i.severity === 'high').length,
              minor: infractionsList.filter((i: any) => i.severity === 'medium' || i.severity === 'low').length
            }

            return {
              ...a,
              driver: a.drivers?.name || 'Inconnu',
              period: `${new Date(a.period_start).toLocaleDateString('fr-FR')} - ${new Date(a.period_end).toLocaleDateString('fr-FR')}`,
              uploadDate: new Date(a.upload_date).toLocaleDateString('fr-FR'),
              infractions: counts
            }
          }))
        }
      } catch (error) {
        console.error('Error fetching analyses:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalyses()
  }, [])

  const deleteAnalysis = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      const res = await fetch('/api/delete-analysis', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: deleteId }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      setAnalyses(prev => prev.filter(a => a.id !== deleteId))
    } catch (err: any) {
      console.error('Erreur suppression:', err)
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const filteredAnalyses = analyses.filter((analysis) => {
    const matchesSearch = analysis.driver.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || analysis.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Analyses" />
        <main className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Analyses tachygraphe</h1>
              <p className="text-muted-foreground">Historique de toutes les analyses effectuées</p>
            </div>
            <Link href="/upload">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Nouvelle analyse
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-6">
              {/* Filters */}
              <div className="mb-6 flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un chauffeur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="completed">Terminée</SelectItem>
                    <SelectItem value="processing">En cours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chauffeur</TableHead>
                      <TableHead>Période analysée</TableHead>
                      <TableHead>Date d'upload</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Infractions</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-[50px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnalyses.map((analysis) => (
                      <TableRow key={analysis.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium text-foreground">{analysis.driver}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{analysis.period}</TableCell>
                        <TableCell className="text-muted-foreground">{analysis.uploadDate}</TableCell>
                        <TableCell>
                          {analysis.status === "completed" ? (
                            <div
                              className={cn(
                                "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-semibold",
                                getScoreBg(analysis.score),
                                getScoreColor(analysis.score),
                              )}
                            >
                              {analysis.score}/100
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {analysis.status === "completed" ? (
                            <div className="flex items-center gap-2">
                              {analysis.infractions.critical > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {analysis.infractions.critical} critiques
                                </Badge>
                              )}
                              {analysis.infractions.major > 0 && (
                                <Badge className="bg-warning/20 text-warning hover:bg-warning/30 text-xs">
                                  {analysis.infractions.major} majeures
                                </Badge>
                              )}
                              {analysis.infractions.minor > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {analysis.infractions.minor} mineures
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={analysis.status === "completed" ? "default" : "secondary"}
                            className={cn(
                              analysis.status === "completed" && "bg-success/20 text-success hover:bg-success/30",
                            )}
                          >
                            {analysis.status === "completed" ? "Terminée" : "En cours"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/analyses/${analysis.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Voir l'analyse
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                const { data: infData } = await supabase
                                  .from('infractions')
                                  .select('date, type, severity')
                                  .eq('analysis_id', analysis.id)
                                generateAnalysisPDF({
                                  driverName: analysis.driver || "Inconnu",
                                  period: analysis.period,
                                  score: analysis.score,
                                  uploadDate: analysis.uploadDate,
                                  infractions: (infData || []).map((inf: any) => ({
                                    date: inf.date,
                                    type: inf.type,
                                    severity: inf.severity,
                                  })),
                                })
                              }}>
                                <Download className="mr-2 h-4 w-4" />
                                Télécharger PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-danger" onClick={() => setDeleteId(analysis.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
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
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Affichage de {filteredAnalyses.length} sur {analyses.length} analyses
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Précédent
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Suivant
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette analyse ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'analyse et toutes les infractions associées seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAnalysis}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
