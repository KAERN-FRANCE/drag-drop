"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DriverHeader } from "@/components/driver/driver-header"
import { GravityBadge } from "@/components/analysis/gravity-badge"
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

const daysOfWeek = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const months = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

const severityToGravity = (severity: string): "3eme" | "4eme" | "5eme" => {
  if (severity === 'critical') return '5eme'
  if (severity === 'high') return '4eme'
  return '3eme'
}

export default function DriverCalendarPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [driver, setDriver] = useState<any>(null)
  const [calendarData, setCalendarData] = useState<Record<string, {
    type: "ok" | "infraction"
    infractions?: { type: string; gravity: "3eme" | "4eme" | "5eme" }[]
  }>>({})

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
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

        // Get infractions for the current month
        const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`
        const endOfMonth = new Date(year, month + 1, 0)
        const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`

        const { data: infractionsData } = await supabase
          .from('infractions')
          .select('*')
          .eq('driver_id', driverData.id)
          .gte('date', startOfMonth)
          .lte('date', endStr)

        if (infractionsData) {
          const dataByDay: Record<string, {
            type: "ok" | "infraction"
            infractions?: { type: string; gravity: "3eme" | "4eme" | "5eme" }[]
          }> = {}

          infractionsData.forEach(inf => {
            const dateKey = inf.date?.split('T')[0] || new Date(inf.date).toISOString().split('T')[0]

            if (!dataByDay[dateKey]) {
              dataByDay[dateKey] = { type: "infraction", infractions: [] }
            }

            dataByDay[dateKey].infractions!.push({
              type: inf.type,
              gravity: severityToGravity(inf.severity)
            })
          })

          setCalendarData(dataByDay)
        }
      } catch (error) {
        console.error('Error loading calendar:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, year, month])

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7

  const daysInMonth = lastDayOfMonth.getDate()
  const days: (number | null)[] = []

  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const todayDay = today.getDate()

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  const formatDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const isDayInPast = (day: number) => {
    if (year < today.getFullYear()) return true
    if (year === today.getFullYear() && month < today.getMonth()) return true
    if (isCurrentMonth && day <= todayDay) return true
    return false
  }

  const selectedDayData = selectedDate ? calendarData[selectedDate] : null

  // Stats — only count past days
  const pastDaysCount = isCurrentMonth ? todayDay : (
    year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth())
      ? daysInMonth
      : 0
  )
  const infractionDays = Object.keys(calendarData).filter(k => {
    const d = parseInt(k.split('-')[2])
    return isDayInPast(d)
  }).length
  const conformeDays = Math.max(0, pastDaysCount - infractionDays)

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
        title="Mon calendrier"
        subtitle="Visualisez vos journées avec et sans infractions"
        driverName={driver?.name || ''}
        driverInitials={driver?.initials || '?'}
      />

      <div className="p-6 space-y-6">
        {/* Month Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Jours écoulés</p>
                <p className="text-xl font-bold text-foreground">{pastDaysCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2.5">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Jours conformes</p>
                <p className="text-xl font-bold text-success">{conformeDays}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-danger/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-danger" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Jours avec infraction</p>
                <p className="text-xl font-bold text-danger">{infractionDays}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">
                  {months[month]} {year}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="aspect-square" />
                  }

                  const dateKey = formatDateKey(day)
                  const dayData = calendarData[dateKey]
                  const isSelected = selectedDate === dateKey
                  const isToday = isCurrentMonth && day === todayDay
                  const isPast = isDayInPast(day)
                  const isFuture = !isPast

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dateKey)}
                      className={cn(
                        "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors relative",
                        isSelected && "ring-2 ring-primary",
                        isToday && "ring-1 ring-primary/50",
                        isFuture && "text-muted-foreground/40 bg-transparent",
                        isPast && dayData?.type === "infraction" && "bg-danger/10 text-danger hover:bg-danger/20",
                        isPast && !dayData && "bg-success/10 text-success hover:bg-success/20",
                      )}
                      disabled={isFuture}
                    >
                      <span className={cn("font-medium", isSelected && "text-primary", isToday && "text-primary font-bold")}>{day}</span>
                      {dayData && isPast && (
                        <div className="absolute bottom-1 flex gap-0.5">
                          <div className="h-1 w-1 rounded-full bg-danger" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-success/20" />
                  <span className="text-xs text-muted-foreground">Conforme</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-danger/20" />
                  <span className="text-xs text-muted-foreground">Infraction</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-muted" />
                  <span className="text-xs text-muted-foreground">Futur</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                {selectedDate ? <>Détails du {selectedDate.split("-").reverse().join("/")}</> : "Sélectionnez un jour"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDayData ? (
                <div className="space-y-4">
                  <div>
                    <Badge className="bg-danger/10 text-danger border-danger/20">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {selectedDayData.infractions?.length || 0} infraction{(selectedDayData.infractions?.length || 0) > 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {selectedDayData.infractions && selectedDayData.infractions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Infractions</p>
                      {selectedDayData.infractions.map((inf, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg border border-danger/20 bg-danger/5"
                        >
                          <AlertTriangle className="h-4 w-4 text-danger flex-shrink-0" />
                          <span className="text-sm text-foreground flex-1">{inf.type}</span>
                          <GravityBadge gravity={inf.gravity} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : selectedDate ? (
                <div className="py-8 text-center">
                  <CheckCircle className="mx-auto h-10 w-10 text-success mb-3" />
                  <Badge className="bg-success/10 text-success border-success/20">
                    Journée conforme
                  </Badge>
                  <p className="mt-3 text-sm text-muted-foreground">Aucune infraction ce jour</p>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Clock className="mx-auto h-10 w-10 mb-3" />
                  <p>Cliquez sur un jour pour voir les détails</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
