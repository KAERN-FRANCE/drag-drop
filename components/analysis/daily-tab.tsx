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
        gravity: inf.severity === 'critical' ? '5eme' : inf.severity === 'high' ? '4eme' : inf.severity === 'medium' ? '3eme' : '3eme'
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
                              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                            >
                              <span className="text-sm">{infraction.type}</span>
                              <GravityBadge gravity={infraction.gravity} />
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
