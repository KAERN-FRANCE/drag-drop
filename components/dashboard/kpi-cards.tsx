"use client"

import type React from "react"

import { ShieldCheck, AlertTriangle, UserX, Euro, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { getUserCompanyId } from "@/lib/company"
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
        const companyId = await getUserCompanyId()

        // Période réglementaire : 12 derniers mois (contrôle en entreprise - CE 561/2006)
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
        const dateLimit = twelveMonthsAgo.toISOString().split('T')[0]

        // Récupérer les chauffeurs
        let driversQuery = supabase.from('drivers').select('id, name')
        if (companyId) driversQuery = driversQuery.eq('company_id', companyId)
        const { data: drivers } = await driversQuery

        // Récupérer les infractions des 12 derniers mois avec driver_id et severity
        let infractionsQuery = supabase.from('infractions').select('driver_id, severity').gte('date', dateLimit)
        if (companyId) infractionsQuery = infractionsQuery.eq('company_id', companyId)
        const { data: infractions } = await infractionsQuery

        if (drivers) {
          const infList = infractions || []
          const totalInfractions = infList.length

          // Calculer le score par chauffeur basé sur ses infractions des 12 derniers mois
          // Pénalités alignées sur l'algo CE 561/2006
          const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }
          const driverScores = drivers.map(driver => {
            const driverInf = infList.filter(inf => inf.driver_id === driver.id)
            let score = 100
            driverInf.forEach(inf => {
              score -= penalites[inf.severity] || 5
            })
            return Math.max(0, Math.min(100, score))
          })

          const avgScore = driverScores.length ? driverScores.reduce((a, b) => a + b, 0) / driverScores.length : 100
          const riskCount = driverScores.filter(s => s < 70).length

          // Calcul amendes basé sur la sévérité réelle
          let totalFines = 0
          infList.forEach(inf => {
            if (inf.severity === 'critical') totalFines += 1500
            else if (inf.severity === 'high') totalFines += 750
            else if (inf.severity === 'medium') totalFines += 135
            else totalFines += 90
          })

          setStats({
            compliance: Math.round(avgScore),
            infractions: totalInfractions,
            riskDrivers: riskCount,
            fines: totalFines,
            driversCount: drivers.length
          })
        }
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
