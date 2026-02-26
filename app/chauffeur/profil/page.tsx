"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DriverHeader } from "@/components/driver/driver-header"
import { User, Mail, Calendar, Save, Loader2, CheckCircle, AlertTriangle } from "lucide-react"

export default function DriverProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [driver, setDriver] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
  })
  const [stats, setStats] = useState({ score: 0, infractions3m: 0, analyses: 0 })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, authRes] = await Promise.all([
          fetch('/api/chauffeur/me', { credentials: 'include' }),
          fetch('/api/me', { credentials: 'include' }),
        ])

        const meData = await meRes.json()
        const authData = await authRes.json()

        if (!meData.driver) {
          if (meRes.status === 401) router.push('/login')
          setLoading(false)
          return
        }

        const driverData = meData.driver
        setDriver(driverData)
        setEmail(authData.user?.email || driverData.email || '')

        const nameParts = driverData.name?.split(' ') || ['', '']
        setFormData({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
        })

        setStats({
          score: meData.stats?.score ?? driverData.score ?? 0,
          infractions3m: meData.stats?.infractions3m ?? 0,
          analyses: meData.stats?.analysesCount ?? 0,
        })
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleSave = async () => {
    if (!driver) return

    setSaving(true)
    setSaved(false)

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()
      const res = await fetch('/api/chauffeur/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: fullName }),
      })

      if (res.ok) {
        const updated = await res.json()
        setSaved(true)
        setDriver({ ...driver, name: updated.name, initials: updated.initials })
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-warning" />
        <h1 className="text-xl font-bold">Profil non trouvé</h1>
        <Button onClick={() => router.push('/chauffeur')}>Retour au tableau de bord</Button>
      </div>
    )
  }

  const createdAt = driver.createdAt
    ? new Date(driver.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A'

  return (
    <div className="min-h-screen bg-background">
      <DriverHeader
        title="Mon profil"
        subtitle="Gérez vos informations personnelles"
        driverName={driver.name}
        driverInitials={driver.initials}
      />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary font-medium">{driver.initials || '?'}</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-semibold text-foreground">{driver.name}</h2>
                <p className="text-muted-foreground">Chauffeur</p>
                <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                    {driver.status === 'active' ? 'Actif' : 'Inactif'}
                  </Badge>
                  <Badge variant="outline">
                    <Calendar className="mr-1 h-3 w-3" />
                    Membre depuis {createdAt}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center rounded-lg bg-muted/50 p-3">
                <p className="text-2xl font-bold text-primary">{stats.score}%</p>
                <p className="text-xs text-muted-foreground">Score (3 mois)</p>
              </div>
              <div className="text-center rounded-lg bg-muted/50 p-3">
                <p className="text-2xl font-bold text-foreground">{stats.infractions3m}</p>
                <p className="text-xs text-muted-foreground">Infractions (3 mois)</p>
              </div>
              <div className="text-center rounded-lg bg-muted/50 p-3">
                <p className="text-2xl font-bold text-foreground">{stats.analyses}</p>
                <p className="text-xs text-muted-foreground">Analyses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations personnelles</CardTitle>
            <CardDescription>Modifiez votre nom et prénom</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="firstName"
                    className="pl-9"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9 bg-muted/50"
                  value={email}
                  disabled
                  readOnly
                />
              </div>
              <p className="text-xs text-muted-foreground">L'email est géré par votre entreprise et ne peut pas être modifié ici.</p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : saved ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4 text-success" />
                Enregistré !
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
