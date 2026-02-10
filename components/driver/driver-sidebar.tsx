"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import {
  Truck,
  LayoutDashboard,
  FileText,
  Calendar,
  AlertTriangle,
  User,
  LogOut,
  Loader2,
} from "lucide-react"

const navigation = [
  { name: "Tableau de bord", href: "/chauffeur", icon: LayoutDashboard },
  { name: "Mes analyses", href: "/chauffeur/analyses", icon: FileText },
  { name: "Calendrier", href: "/chauffeur/calendrier", icon: Calendar },
  { name: "Mes infractions", href: "/chauffeur/infractions", icon: AlertTriangle, showBadge: true },
]

const secondaryNavigation = [
  { name: "Mon profil", href: "/chauffeur/profil", icon: User },
]

export function DriverSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [driver, setDriver] = useState<any>(null)
  const [infractionsCount, setInfractionsCount] = useState(0)

  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        const { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (driverData) {
          // Calculer le score dynamiquement sur les 3 derniers mois
          const threeMonthsAgo = new Date()
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
          const dateLimit = threeMonthsAgo.toISOString().split('T')[0]

          const { data: infData } = await supabase
            .from('infractions')
            .select('severity')
            .eq('driver_id', driverData.id)
            .gte('date', dateLimit)

          const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }
          let score = 100
          ;(infData || []).forEach((inf: any) => { score -= penalites[inf.severity] || 1 })
          score = Math.max(0, Math.min(100, score))

          setDriver({ ...driverData, score })
          setInfractionsCount(infData?.length || 0)
        }
      } catch (error) {
        console.error('Error loading sidebar data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDriverData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_type")
    router.push("/login")
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <span className="text-lg font-bold text-foreground">TachoCompliance</span>
          <p className="text-xs text-muted-foreground">Espace Chauffeur</p>
        </div>
      </div>

      {/* Driver Info Card */}
      <div className="border-b border-border p-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : driver ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{driver.initials || '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{driver.name}</p>
                <p className="text-xs text-muted-foreground">Chauffeur</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">Score (3 mois)</span>
              <span className={cn(
                "text-lg font-bold",
                driver.score >= 85 ? "text-success" : driver.score >= 70 ? "text-primary" : "text-warning"
              )}>{driver.score}%</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Profil non trouvé</p>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Navigation</p>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
              {item.showBadge && infractionsCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warning/10 px-1.5 text-xs font-medium text-warning">
                  {infractionsCount}
                </span>
              )}
            </Link>
          )
        })}

        <div className="my-4 border-t border-border" />

        <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Mon compte</p>
        {secondaryNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-danger hover:text-danger hover:bg-danger/10"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Déconnexion
        </Button>
      </div>
    </aside>
  )
}
