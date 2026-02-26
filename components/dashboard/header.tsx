"use client"

import { useRouter } from "next/navigation"
import { ChevronDown, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"

interface DashboardHeaderProps {
  breadcrumb: string
}

export function DashboardHeader({ breadcrumb }: DashboardHeaderProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [companyName, setCompanyName] = useState("")

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.user) {
          setUserName(data.user.name || data.user.email?.split('@')[0] || 'Utilisateur')
          setCompanyName(data.companyName || 'Mon Entreprise')
        }
      })
      .catch(() => setCompanyName('Mon Entreprise'))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/login")
  }

  const getInitials = () => {
    if (!userName) return '?'
    const parts = userName.split(' ')
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || userName.substring(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{breadcrumb}</h1>
        <p className="text-sm text-muted-foreground">
          {loading ? <span className="animate-pulse">Chargement...</span> : companyName}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent outline-none">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium text-foreground">
              {loading ? <span className="animate-pulse">...</span> : userName}
            </p>
            <p className="text-xs text-muted-foreground">Administrateur</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push("/compte")}>Mon profil</DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/parametres")}>Paramètres</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
