"use client"

import { useState, useMemo } from "react"
import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { GravityBadge } from "./gravity-badge"

interface DailyTabProps {
  infractions: any[]
}

export function DailyTab({ infractions }: DailyTabProps) {
  const [expandedRows, setExpandedRows] = useState<string[]>([])

  const dailyData = useMemo(() => {
    const grouped = new Map<string, any[]>()

    infractions.forEach(inf => {
      const date = new Date(inf.date).toLocaleDateString('fr-FR')
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

    return Array.from(grouped.entries()).map(([date, infs]) => ({
      date,
      dayName: (() => {
        const [d, m, y] = date.split('/').map(Number)
        return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long' })
      })(),
      infractions: infs
    })).sort((a, b) => {
      const [da, ma, ya] = a.date.split('/').map(Number)
      const [db, mb, yb] = b.date.split('/').map(Number)
      return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime()
    })
  }, [infractions])

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
          <p className="text-muted-foreground text-center py-8">Aucune infraction enregistrée sur cette analyse.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Détail par journée — {dailyData.length} jour{dailyData.length > 1 ? 's' : ''} avec infractions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Jour</TableHead>
                <TableHead className="text-right">Infractions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyData.map((day) => (
                <React.Fragment key={day.date}>
                  <TableRow
                    className={cn(
                      "cursor-pointer transition-colors",
                      day.infractions.length > 3 ? "bg-danger/5 hover:bg-danger/10" :
                      day.infractions.length > 1 ? "bg-warning/5 hover:bg-warning/10" :
                      "hover:bg-muted/50"
                    )}
                    onClick={() => toggleRow(day.date)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expandedRows.includes(day.date) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{day.date}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{day.dayName}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={day.infractions.length > 3 ? "destructive" : "secondary"}
                        className="font-mono"
                      >
                        {day.infractions.length}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(day.date) && (
                    <TableRow key={`${day.date}-details`}>
                      <TableCell colSpan={4} className="bg-muted/30 p-4">
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
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
