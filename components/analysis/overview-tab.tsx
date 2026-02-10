"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GravityBadge } from "./gravity-badge"
import { Euro } from "lucide-react"
import { useMemo } from "react"

interface OverviewTabProps {
  infractions: any[]
}

const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
}
const tooltipLabelStyle = { color: "#e2e8f0", fontWeight: 600, fontSize: 13, marginBottom: 4 }
const tooltipItemStyle = { color: "#94a3b8", fontSize: 12 }

const severityConfig = [
  { key: "critical", label: "Critiques (5ème classe / délit)", color: "#ef4444", cost: 1500 },
  { key: "high", label: "Majeures (4ème classe)", color: "#f97316", cost: 750 },
  { key: "medium", label: "Moyennes (3ème classe)", color: "#eab308", cost: 135 },
  { key: "low", label: "Mineures", color: "#22c55e", cost: 90 },
]

export function OverviewTab({ infractions }: OverviewTabProps) {
  const stats = useMemo(() => {
    if (!infractions.length) return {
      distribution: [],
      evolution: [],
      top: [],
      totalCost: 0,
      severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
    }

    // Severity breakdown
    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 }
    infractions.forEach(inf => {
      const sev = inf.severity as keyof typeof severityBreakdown
      if (severityBreakdown[sev] !== undefined) severityBreakdown[sev]++
    })

    // Distribution by type
    const distMap = new Map<string, { count: number; severity: string }>()
    infractions.forEach(inf => {
      const existing = distMap.get(inf.type)
      if (existing) {
        existing.count++
      } else {
        distMap.set(inf.type, { count: 1, severity: inf.severity })
      }
    })

    const distribution = Array.from(distMap.entries())
      .map(([name, { count, severity }]) => ({ name, value: count, severity }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    // Evolution by date
    const evoMap = new Map<string, number>()
    const dateKeys: string[] = []
    infractions.forEach(inf => {
      const d = new Date(inf.date)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      if (!evoMap.has(key)) {
        evoMap.set(key, 0)
        dateKeys.push(key)
      }
      evoMap.set(key, (evoMap.get(key) || 0) + 1)
    })
    dateKeys.sort()
    const evolution = dateKeys.map(key => {
      const [year, month] = key.split('-')
      const d = new Date(Number(year), Number(month))
      return {
        month: d.toLocaleDateString('fr-FR', { month: 'short' }),
        count: evoMap.get(key) || 0,
      }
    })

    // Top infractions
    const top = Array.from(distMap.entries())
      .map(([type, { count, severity }]) => ({
        type,
        count,
        gravity: severity === 'critical' ? '5eme' : severity === 'high' ? '4eme' : severity === 'medium' ? '3eme' : '3eme'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Cost by severity
    let totalCost = 0
    infractions.forEach(inf => {
      if (inf.severity === 'critical') totalCost += 1500
      else if (inf.severity === 'high') totalCost += 750
      else if (inf.severity === 'medium') totalCost += 135
      else totalCost += 90
    })

    return { distribution, evolution, top, totalCost, severityBreakdown }
  }, [infractions])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Severity Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Répartition par gravité</CardTitle>
        </CardHeader>
        <CardContent>
          {infractions.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground">Aucune infraction</p>
            </div>
          ) : (
            <div className="space-y-3">
              {severityConfig.map(s => {
                const count = stats.severityBreakdown[s.key as keyof typeof stats.severityBreakdown]
                const pct = infractions.length > 0 ? (count / infractions.length) * 100 : 0
                return (
                  <div key={s.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-sm text-foreground">{s.label}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {count} <span className="text-xs font-normal text-muted-foreground">({Math.round(pct)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evolution Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Évolution sur la période</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.evolution.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground">Pas de données</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.evolution} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInfOverview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fill="url(#colorInfOverview)"
                  name="Infractions"
                  dot={{ r: 4, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Détail du coût potentiel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="rounded-lg bg-danger/10 p-3">
              <Euro className="h-8 w-8 text-danger" />
            </div>
            <div>
              <p className="font-mono text-3xl font-bold text-danger">{stats.totalCost.toLocaleString()}€</p>
              <p className="text-sm text-muted-foreground">Risque total si contrôle</p>
            </div>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            {severityConfig.map(s => {
              const count = stats.severityBreakdown[s.key as keyof typeof stats.severityBreakdown]
              if (count === 0) return null
              return (
                <div key={s.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{count}x {s.label.split(' (')[0]}</span>
                  <span className="font-mono font-semibold text-foreground">{(count * s.cost).toLocaleString()}€</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Infractions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Top infractions</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.top.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground">Aucune infraction</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.top.map((infraction, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">{infraction.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-danger">{infraction.count}</span>
                    <GravityBadge gravity={infraction.gravity as any} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
