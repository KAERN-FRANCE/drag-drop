"use client"

import type React from "react"

import { ShieldCheck, AlertTriangle, UserX, Euro, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface KPICardProps {
  icon: React.ElementType
  value: string
  label: string
  subtitle?: string
  iconColor?: "success" | "warning" | "danger" | "default"
  loading?: boolean
}

function KPICard({ icon: Icon, value, label, subtitle, iconColor = "default", loading }: KPICardProps) {
  const colorClasses = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    default: "bg-primary/10 text-primary",
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className={cn("rounded-lg p-2", colorClasses[iconColor])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <p className="font-mono text-3xl font-bold text-foreground">{value}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function KPICards() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    compliance: 0,
    infractions: 0,
    riskDrivers: 0,
    fines: 0,
    driversCount: 0
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const dateLimit = new Date()
        dateLimit.setMonth(dateLimit.getMonth() - 12)
        const dateLimitStr = dateLimit.toISOString().split('T')[0]

        const [driversRes, infractionsRes] = await Promise.all([
          fetch('/api/drivers', { credentials: 'include' }),
          fetch(`/api/infractions?dateFrom=${dateLimitStr}`, { credentials: 'include' }),
        ])

        const driversData = await driversRes.json()
        const infList: any[] = await infractionsRes.json()

        const driversList: any[] = driversData.drivers || []

        const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }
        const driverScores = driversList.map(driver => {
          const driverInf = infList.filter((inf: any) => inf.driverId === driver.id)
          let score = 100
          driverInf.forEach((inf: any) => { score -= penalites[inf.severity] || 5 })
          return Math.max(0, Math.min(100, score))
        })

        const avgScore = driverScores.length ? driverScores.reduce((a, b) => a + b, 0) / driverScores.length : 100
        const riskCount = driverScores.filter(s => s < 70).length

        let totalFines = 0
        infList.forEach((inf: any) => {
          if (inf.severity === 'critical') totalFines += 1500
          else if (inf.severity === 'high') totalFines += 750
          else if (inf.severity === 'medium') totalFines += 135
          else totalFines += 90
        })

        setStats({
          compliance: Math.round(avgScore),
          infractions: infList.length,
          riskDrivers: riskCount,
          fines: totalFines,
          driversCount: driversList.length
        })
      } catch (error) {
        console.error('Error fetching KPI stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        icon={ShieldCheck}
        value={`${stats.compliance}%`}
        label="Taux de conformité"
        subtitle={`Moyenne sur ${stats.driversCount} chauffeur${stats.driversCount > 1 ? 's' : ''}`}
        iconColor="success"
        loading={loading}
      />
      <KPICard
        icon={AlertTriangle}
        value={stats.infractions.toString()}
        label="Infractions (12 mois)"
        subtitle="Période réglementaire contrôle entreprise"
        iconColor="warning"
        loading={loading}
      />
      <KPICard
        icon={UserX}
        value={stats.riskDrivers.toString()}
        label="Chauffeurs à risque"
        subtitle="Score < 70%"
        iconColor="danger"
        loading={loading}
      />
      <KPICard
        icon={Euro}
        value={`${stats.fines.toLocaleString()}€`}
        label="Coût potentiel amendes"
        subtitle="Risque si contrôle (12 mois)"
        iconColor="danger"
        loading={loading}
      />
    </div>
  )
}
