import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { MonthlyEvolutionChart, SeverityBreakdownChart, TopInfractionsChart } from "@/components/dashboard/charts"
import { DriversTable } from "@/components/dashboard/drivers-table"
import { UploadButton } from "@/components/dashboard/upload-button"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Tableau de bord" />
        <main className="p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* KPI Cards */}
            <KPICards />

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-3">
              <MonthlyEvolutionChart />
              <SeverityBreakdownChart />
            </div>

            {/* Top Infractions */}
            <TopInfractionsChart />

            {/* Drivers Table */}
            <DriversTable />
          </div>
        </main>
      </div>
      <UploadButton />
    </div>
  )
}
