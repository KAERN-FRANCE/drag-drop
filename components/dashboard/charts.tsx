"use client"

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getUserCompanyId } from "@/lib/company"
import { useEffect, useState } from "react"

const getMonthName = (date: Date) => {
  return date.toLocaleDateString('fr-FR', { month: 'short' })
}

const getDateLimit12Months = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d.toISOString().split('T')[0]
}

const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
}

const tooltipLabelStyle = {
  color: "#e2e8f0",
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 4,
}

const tooltipItemStyle = {
  color: "#94a3b8",
  fontSize: 12,
}


export function MonthlyEvolutionChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const companyId = await getUserCompanyId()
        let query = supabase.from('infractions').select('date').gte('date', getDateLimit12Months()).order('date', { ascending: true })
        if (companyId) query = query.eq('company_id', companyId)
        const { data: infractions } = await query

        if (infractions && infractions.length > 0) {
          const monthOrder: string[] = []
          const counts: Record<string, number> = {}

          infractions.forEach(inf => {
            const d = new Date(inf.date)
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
            const label = getMonthName(d)
            if (!counts[key]) {
              counts[key] = 0
              monthOrder.push(key)
            }
            counts[key]++
          })

          monthOrder.sort()

          const chartData = monthOrder.map(key => {
            const [year, month] = key.split('-')
            const d = new Date(Number(year), Number(month))
            return {
              month: getMonthName(d),
              infractions: counts[key]
            }
          })

          setData(chartData)
        }
      } catch (error) {
        console.error('Error fetching chart data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Évolution des infractions <span className="text-xs opacity-70">(12 derniers mois)</span></CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-center">
            <p className="text-muted-foreground text-sm">Aucune donnée disponible</p>
            <p className="text-xs text-muted-foreground mt-1">Les infractions apparaîtront ici après analyse</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInfractions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={{ stroke: "#3b82f6", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="infractions"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#colorInfractions)"
                name="Infractions"
                dot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}


export function SeverityBreakdownChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ critical: 0, high: 0, medium: 0, low: 0 })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const companyId = await getUserCompanyId()
        let query = supabase.from('infractions').select('date, severity').gte('date', getDateLimit12Months())
        if (companyId) query = query.eq('company_id', companyId)
        const { data: infractions } = await query

        if (infractions && infractions.length > 0) {
          const monthData: Record<string, { critical: number; high: number; medium: number; low: number }> = {}
          const monthOrder: string[] = []
          const tots = { critical: 0, high: 0, medium: 0, low: 0 }

          infractions.forEach(inf => {
            const d = new Date(inf.date)
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
            if (!monthData[key]) {
              monthData[key] = { critical: 0, high: 0, medium: 0, low: 0 }
              monthOrder.push(key)
            }
            const sev = inf.severity as keyof typeof tots
            if (tots[sev] !== undefined) {
              monthData[key][sev]++
              tots[sev]++
            }
          })

          monthOrder.sort()

          const chartData = monthOrder.map(key => {
            const [year, month] = key.split('-')
            const d = new Date(Number(year), Number(month))
            return {
              month: getMonthName(d),
              ...monthData[key],
            }
          })

          setData(chartData)
          setTotals(tots)
        }
      } catch (error) {
        console.error('Error fetching severity data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const severityConfig = [
    { key: "critical", label: "Critiques", color: "#ef4444" },
    { key: "high", label: "Majeures", color: "#f97316" },
    { key: "medium", label: "Moyennes", color: "#eab308" },
    { key: "low", label: "Mineures", color: "#22c55e" },
  ]

  const total = totals.critical + totals.high + totals.medium + totals.low

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Répartition par gravité <span className="text-xs opacity-70">(12 derniers mois)</span></CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-center">
            <p className="text-muted-foreground text-sm">Aucune infraction</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="grid grid-cols-2 gap-2">
              {severityConfig.map(s => {
                const count = totals[s.key as keyof typeof totals]
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={s.key} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                      <p className="text-sm font-semibold text-foreground">{count} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span></p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Stacked bar chart */}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                />
                {severityConfig.map(s => (
                  <Bar key={s.key} dataKey={s.key} stackId="severity" name={s.label} fill={s.color} radius={s.key === "low" ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


export function TopInfractionsChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const companyId = await getUserCompanyId()
        let query = supabase.from('infractions').select('type').gte('date', getDateLimit12Months())
        if (companyId) query = query.eq('company_id', companyId)
        const { data: infractions } = await query

        if (infractions) {
          const counts: Record<string, number> = {}
          infractions.forEach(inf => {
            counts[inf.type] = (counts[inf.type] || 0) + 1
          })

          const chartData = Object.keys(counts)
            .map(type => ({ type, count: counts[type] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

          setData(chartData)
        }
      } catch (error) {
        console.error('Error fetching top infractions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const colors = ["#3b82f6", "#6366f1", "#8b5cf6", "#0ea5e9", "#06b6d4"]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Top 5 — Infractions les plus fréquentes <span className="text-xs opacity-70">(12 derniers mois)</span></CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-center">
            <p className="text-muted-foreground text-sm">Aucune infraction enregistrée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item, index) => {
              const maxCount = data[0].count
              const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
              return (
                <div key={item.type} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground truncate max-w-[70%]">{item.type}</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{item.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: colors[index % colors.length],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
