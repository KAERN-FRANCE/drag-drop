"use client"

import { useState, useMemo } from "react"
import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Car, Briefcase, Coffee, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { GravityBadge } from "./gravity-badge"

interface DailyStats {
  date: string
  dateLabel: string
  drivingMinutes: number
  workMinutes: number
  restMinutes: number
  availabilityMinutes: number
  amplitudeMinutes: number
}

interface DailyTabProps {
  infractions: any[]
  dailyStats?: DailyStats[]
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return "-"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

export function DailyTab({ infractions, dailyStats = [] }: DailyTabProps) {
  const [expandedRows, setExpandedRows] = useState<string[]>([])

  // Grouper les infractions par date
  const infractionsByDate = useMemo(() => {
    const grouped = new Map<string, any[]>()
    infractions.forEach(inf => {
      const date = inf.date // format YYYY-MM-DD
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)?.push({
        type: inf.type,
        severity: inf.severity,
        gravity: inf.details?.gravite || (inf.severity === 'critical' ? 'delit' : inf.severity === 'high' ? '5eme' : inf.severity === 'medium' ? '4eme' : '3eme'),
        details: inf.details || null,
      })
    })
    return grouped
  }, [infractions])

  // Combiner dailyStats avec les infractions
  const dailyData = useMemo(() => {
    if (dailyStats.length === 0) {
      // Fallback : afficher uniquement les jours avec infractions
      return Array.from(infractionsByDate.entries()).map(([date, infs]) => {
        const [y, m, d] = date.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
        return {
          date,
          dateLabel: `${JOURS[dateObj.getDay()]}. ${d} ${dateObj.toLocaleDateString('fr-FR', { month: 'short' })}. ${y}`,
          drivingMinutes: 0,
          workMinutes: 0,
          restMinutes: 0,
          amplitudeMinutes: 0,
          infractions: infs,
        }
      }).sort((a, b) => b.date.localeCompare(a.date))
    }

    return dailyStats.map(day => ({
      ...day,
      infractions: infractionsByDate.get(day.date) || [],
    })).sort((a, b) => b.date.localeCompare(a.date))
  }, [dailyStats, infractionsByDate])

  const toggleRow = (date: string) => {
    setExpandedRows((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]))
  }

  if (dailyData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Détail par journée</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Aucune donnée disponible pour cette analyse.</p>
        </CardContent>
      </Card>
    )
  }

  // Calculer les totaux
  const totals = dailyData.reduce((acc, day) => ({
    driving: acc.driving + day.drivingMinutes,
    work: acc.work + day.workMinutes,
    rest: acc.rest + day.restMinutes,
    infractions: acc.infractions + day.infractions.length,
  }), { driving: 0, work: 0, rest: 0, infractions: 0 })

  return (
    <div className="space-y-4">
      {/* Résumé rapide */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Car className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(totals.driving)}</p>
                <p className="text-xs text-muted-foreground">Conduite totale</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Briefcase className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(totals.work)}</p>
                <p className="text-xs text-muted-foreground">Travail total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Coffee className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(totals.rest)}</p>
                <p className="text-xs text-muted-foreground">Repos/Pause total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dailyData.length}</p>
                <p className="text-xs text-muted-foreground">Jours analysés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau détaillé */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Détail par journée — {dailyData.length} jour{dailyData.length > 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Car className="h-3.5 w-3.5" /> Conduite
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Briefcase className="h-3.5 w-3.5" /> Travail
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Coffee className="h-3.5 w-3.5" /> Repos
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Amplitude</TableHead>
                  <TableHead className="text-right">Infractions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyData.map((day) => {
                  const drivingOver9h = day.drivingMinutes > 540
                  const drivingOver10h = day.drivingMinutes > 600
                  const amplitudeOver12h = day.amplitudeMinutes > 720

                  return (
                    <React.Fragment key={day.date}>
                      <TableRow
                        className={cn(
                          "cursor-pointer transition-colors",
                          day.infractions.length > 0 ? "bg-danger/5 hover:bg-danger/10" :
                          drivingOver9h ? "bg-warning/5 hover:bg-warning/10" :
                          "hover:bg-muted/50"
                        )}
                        onClick={() => day.infractions.length > 0 && toggleRow(day.date)}
                      >
                        <TableCell>
                          {day.infractions.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {expandedRows.includes(day.date) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{day.dateLabel}</TableCell>
                        <TableCell className={cn(
                          "text-right font-mono",
                          drivingOver10h ? "text-red-500 font-semibold" :
                          drivingOver9h ? "text-orange-500 font-semibold" : ""
                        )}>
                          {formatDuration(day.drivingMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatDuration(day.workMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatDuration(day.restMinutes)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono",
                          amplitudeOver12h ? "text-orange-500 font-semibold" : ""
                        )}>
                          {formatDuration(day.amplitudeMinutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {day.infractions.length > 0 ? (
                            <Badge variant="destructive" className="font-mono">
                              {day.infractions.length}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedRows.includes(day.date) && day.infractions.length > 0 && (
                        <TableRow key={`${day.date}-details`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="space-y-2">
                              {day.infractions.map((infraction: any, index: number) => (
                                <div
                                  key={index}
                                  className="rounded-lg border border-border bg-card px-3 py-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{infraction.type}</span>
                                    <GravityBadge gravity={infraction.gravity} />
                                  </div>
                                  {infraction.details && (
                                    <div className="mt-1.5 space-y-1">
                                      <p className="text-sm text-foreground">{infraction.details.detail}</p>
                                      <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-muted-foreground">
                                        <span>Constaté : <span className="font-mono font-semibold text-foreground">{typeof infraction.details.valeur_constatee === 'number' ? infraction.details.valeur_constatee.toFixed(2) : infraction.details.valeur_constatee}h</span></span>
                                        <span>Limite : <span className="font-mono font-semibold text-foreground">{typeof infraction.details.limite_reglementaire === 'number' ? infraction.details.limite_reglementaire.toFixed(2) : infraction.details.limite_reglementaire}h</span></span>
                                        <span>Amende : <span className="font-mono font-semibold text-foreground">{infraction.details.amende_min}€ – {infraction.details.amende_max}€</span></span>
                                        <span>{infraction.details.article_loi}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
