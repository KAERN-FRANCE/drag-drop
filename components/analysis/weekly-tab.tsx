"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { GravityBadge } from "./gravity-badge"

interface WeeklyTabProps {
  infractions: any[]
}

export function WeeklyTab({ infractions }: WeeklyTabProps) {
  const [openWeeks, setOpenWeeks] = useState<string[]>([])

  const weeklyData = useMemo(() => {
    const getWeek = (date: Date) => {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + 4 - (d.getDay() || 7))
      const yearStart = new Date(d.getFullYear(), 0, 1)
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
      return { week: weekNo, year: d.getFullYear() }
    }

    const grouped = new Map<string, any>()

    infractions.forEach(inf => {
      const date = new Date(inf.date)
      const { week, year } = getWeek(date)
      const key = `${year}-W${week}`

      if (!grouped.has(key)) {
        grouped.set(key, {
          week: `Semaine ${week}`,
          year,
          infractions: 0,
          days: new Map<string, any[]>()
        })
      }

      const weekData = grouped.get(key)
      weekData.infractions += 1

      const dayKey = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
      if (!weekData.days.has(dayKey)) {
        weekData.days.set(dayKey, [])
      }
      weekData.days.get(dayKey).push({
        type: inf.type,
        severity: inf.severity,
        gravity: inf.severity === 'critical' ? '5eme' : inf.severity === 'high' ? '4eme' : inf.severity === 'medium' ? '3eme' : '3eme'
      })
    })

    return Array.from(grouped.values()).map(week => ({
      ...week,
      days: Array.from(week.days.entries()).map(([date, infs]: [string, any[]]) => ({
        date,
        infractions: infs,
      }))
    })).sort((a, b) => b.year - a.year || parseInt(b.week.split(' ')[1]) - parseInt(a.week.split(' ')[1]))

  }, [infractions])

  const toggleWeek = (week: string) => {
    setOpenWeeks((prev) => (prev.includes(week) ? prev.filter((w) => w !== week) : [...prev, week]))
  }

  if (weeklyData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">Aucune donnée hebdomadaire disponible.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {weeklyData.map((week, index) => (
        <Card key={`${week.week}-${index}`}>
          <Collapsible open={openWeeks.includes(week.week)} onOpenChange={() => toggleWeek(week.week)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-base">{week.week}</CardTitle>
                    <span className="text-sm text-muted-foreground">{week.year}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <Badge
                      variant={week.infractions > 5 ? "destructive" : "secondary"}
                      className="font-mono"
                    >
                      {week.infractions} infraction{week.infractions > 1 ? 's' : ''}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      {openWeeks.includes(week.week) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {week.days.map((day: any) => (
                    <div key={day.date} className="rounded-lg border border-border">
                      <div className={cn(
                        "flex items-center justify-between p-3",
                        day.infractions.length > 2 ? "bg-danger/5" : "bg-warning/5"
                      )}>
                        <span className="font-medium capitalize text-sm">{day.date}</span>
                        <Badge
                          variant={day.infractions.length > 2 ? "destructive" : "secondary"}
                          className="font-mono"
                        >
                          {day.infractions.length}
                        </Badge>
                      </div>
                      <div className="p-3 space-y-1.5">
                        {day.infractions.map((inf: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{inf.type}</span>
                            <GravityBadge gravity={inf.gravity} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  )
}
