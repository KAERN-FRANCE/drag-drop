"use client"

import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { MonthlyEvolutionChart, SeverityBreakdownChart, TopInfractionsChart } from "@/components/dashboard/charts"
import { DriversTable } from "@/components/dashboard/drivers-table"
import { UploadButton } from "@/components/dashboard/upload-button"
import { DateRangePicker } from "@/components/dashboard/date-range-picker"

function getDefault12MonthRange(): DateRange {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 12)
  return { from, to }
}

function toISODate(d: Date) {
  return d.toISOString().split('T')[0]
}

export function DashboardContent() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefault12MonthRange)

  const dateFrom = dateRange.from ? toISODate(dateRange.from) : toISODate(new Date(Date.now() - 365 * 86400000))
  const dateTo = dateRange.to ? toISODate(dateRange.to) : toISODate(new Date())

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Tableau de bord" />
        <main className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Tableau de bord</h2>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            <KPICards dateFrom={dateFrom} dateTo={dateTo} />

            <div className="grid gap-6 lg:grid-cols-3">
              <MonthlyEvolutionChart dateFrom={dateFrom} dateTo={dateTo} />
              <SeverityBreakdownChart dateFrom={dateFrom} dateTo={dateTo} />
            </div>

            <TopInfractionsChart dateFrom={dateFrom} dateTo={dateTo} />

            <DriversTable dateFrom={dateFrom} dateTo={dateTo} />
          </div>
        </main>
      </div>
      <UploadButton />
    </div>
  )
}
