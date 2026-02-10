"use client"

import { useRouter } from "next/navigation"
import { ChevronDown, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface DashboardHeaderProps {
  breadcrumb: string
}

export function DashboardHeader({ breadcrumb }: DashboardHeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState("")

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUser(user)

          // Get company name from companies table via user_companies
          const { data: userCompanyData } = await supabase
            .from('user_companies')
            .select('company_id')
            .eq('user_id', user.id)
            .single()

          if (userCompanyData?.company_id) {
            const { data: companyInfo } = await supabase
              .from('companies')
              .select('name')
              .eq('id', userCompanyData.company_id)
              .single()

            if (companyInfo?.name) {
              setCompanyName(companyInfo.name)
            } else {
              setCompanyName("Mon Entreprise")
            }
          } else {
            setCompanyName("Mon Entreprise")
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error)
        setCompanyName("Mon Entreprise")
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    router.push("/login")
  }

  const getUserDisplayName = () => {
    if (!user) return ""
    const metadata = user.user_metadata || {}

    // Build full name from first_name and last_name
    if (metadata.first_name && metadata.last_name) {
      return `${metadata.first_name} ${metadata.last_name}`
    }

    // Fallback to other possible formats
    return metadata.full_name || metadata.name || user.email?.split('@')[0] || "Utilisateur"
  }

  const getUserInitials = () => {
    if (!user) return ""
    const metadata = user.user_metadata || {}

    // Use first letter of first_name and last_name
    if (metadata.first_name && metadata.last_name) {
      return (metadata.first_name.charAt(0) + metadata.last_name.charAt(0)).toUpperCase()
    }

    // Fallback: use first 2 letters of display name
    const name = getUserDisplayName()
    return name.substring(0, 2).toUpperCase()
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
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium text-foreground">
              {loading ? <span className="animate-pulse">...</span> : getUserDisplayName()}
            </p>
            <p className="text-xs text-muted-foreground">
              {loading ? "" : (user?.user_metadata?.role || "Administrateur")}
            </p>
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
