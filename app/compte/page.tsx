"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, Bell, Shield, Camera, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const tabs = [
  { id: "profile", label: "Profil", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Sécurité", icon: Shield },
]

export default function AccountPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("profile")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [user, setUser] = useState<any>(null)

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  const [notifications, setNotifications] = useState({
    email: true,
    criticalAlerts: true,
    weeklyReport: true,
    newAnalysis: false,
  })

  // Password change states
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Delete account states
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
          router.push('/login')
          return
        }

        setUser(authUser)

        // Try to parse name from email or user metadata
        const email = authUser.email || ''
        const metadata = authUser.user_metadata || {}
        const fullName = metadata.full_name || metadata.name || ''
        const nameParts = fullName.split(' ')

        setFormData({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          email: email,
          phone: metadata.phone || '',
        })
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [router])

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
        }
      })

      if (error) {
        console.error('Error saving profile:', error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    setPasswordError("")
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError("Le mot de passe doit contenir au moins 6 caractères")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas")
      return
    }

    setChangingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        setPasswordError(error.message)
      } else {
        setPasswordSuccess(true)
        setNewPassword("")
        setConfirmPassword("")
        setTimeout(() => setPasswordSuccess(false), 5000)
      }
    } catch (error) {
      console.error('Error changing password:', error)
      setPasswordError("Une erreur est survenue")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (confirmText !== "SUPPRIMER") {
      setDeleteError("Veuillez taper SUPPRIMER pour confirmer")
      return
    }

    setDeleting(true)
    setDeleteError("")

    try {
      await supabase.auth.signOut()
      localStorage.clear()
      router.push('/')
    } catch (error) {
      console.error('Error deleting account:', error)
      setDeleteError("Une erreur est survenue")
    } finally {
      setDeleting(false)
    }
  }

  const getInitials = () => {
    const first = formData.firstName?.[0] || ''
    const last = formData.lastName?.[0] || ''
    return (first + last).toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="ml-64 flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Mon compte" />
        <main className="p-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex gap-8">
              {/* Vertical Tabs */}
              <nav className="w-48 flex-shrink-0 space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              {/* Content */}
              <div className="flex-1">
                {activeTab === "profile" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Informations personnelles</CardTitle>
                      <CardDescription>Gérez vos informations de profil</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Avatar */}
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Avatar className="h-20 w-20">
                            <AvatarFallback className="bg-primary/10 text-primary text-xl">
                              {getInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <button className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                            <Camera className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {formData.firstName} {formData.lastName || user?.email}
                          </p>
                          <p className="text-sm text-muted-foreground">RH Admin</p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Prénom</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          />
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
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Téléphone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>

                      <Button onClick={handleSaveProfile} disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enregistrement...
                          </>
                        ) : saved ? (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Enregistré !
                          </>
                        ) : (
                          "Sauvegarder"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {activeTab === "notifications" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Préférences de notification</CardTitle>
                      <CardDescription>Choisissez les notifications que vous souhaitez recevoir</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div>
                          <p className="font-medium text-foreground">Notifications par email</p>
                          <p className="text-sm text-muted-foreground">Recevoir les notifications par email</p>
                        </div>
                        <Switch
                          checked={notifications.email}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div>
                          <p className="font-medium text-foreground">Alertes critiques</p>
                          <p className="text-sm text-muted-foreground">
                            Être notifié immédiatement des infractions critiques
                          </p>
                        </div>
                        <Switch
                          checked={notifications.criticalAlerts}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, criticalAlerts: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div>
                          <p className="font-medium text-foreground">Rapport hebdomadaire</p>
                          <p className="text-sm text-muted-foreground">Recevoir un récapitulatif chaque lundi</p>
                        </div>
                        <Switch
                          checked={notifications.weeklyReport}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyReport: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div>
                          <p className="font-medium text-foreground">Nouvelle analyse terminée</p>
                          <p className="text-sm text-muted-foreground">Être notifié quand une analyse est prête</p>
                        </div>
                        <Switch
                          checked={notifications.newAnalysis}
                          onCheckedChange={(checked) => setNotifications({ ...notifications, newAnalysis: checked })}
                        />
                      </div>

                      <Button>Sauvegarder les préférences</Button>
                    </CardContent>
                  </Card>
                )}

                {activeTab === "security" && (
                  <div className="space-y-6">
                    {/* Password Change */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Modifier le mot de passe</CardTitle>
                        <CardDescription>Changez votre mot de passe de connexion</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                          <div className="relative">
                            <Input
                              id="newPassword"
                              type={showPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                          <Input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                        </div>

                        {passwordError && (
                          <p className="text-sm text-danger flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            {passwordError}
                          </p>
                        )}

                        {passwordSuccess && (
                          <p className="text-sm text-success flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Mot de passe modifié avec succès !
                          </p>
                        )}

                        <Button
                          onClick={handlePasswordChange}
                          disabled={changingPassword || !newPassword || !confirmPassword}
                        >
                          {changingPassword ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Modification...
                            </>
                          ) : (
                            "Modifier le mot de passe"
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Delete Account - GDPR */}
                    <Card className="border-danger/50">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-danger" />
                          <CardTitle className="text-danger">Zone de danger</CardTitle>
                        </div>
                        <CardDescription>Actions irréversibles sur votre compte</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 rounded-lg bg-danger/5 border border-danger/20">
                          <h3 className="font-medium text-foreground">Supprimer mon compte</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Conformément au RGPD, vous pouvez supprimer votre compte et vos données.
                          </p>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" className="mt-4">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer mon compte
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-danger">
                                  <AlertTriangle className="h-5 w-5" />
                                  Supprimer définitivement votre compte ?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="space-y-4">
                                  <p>Cette action est <strong>irréversible</strong>.</p>
                                  <div className="space-y-2">
                                    <Label htmlFor="confirm">
                                      Tapez <strong className="text-danger">SUPPRIMER</strong> pour confirmer
                                    </Label>
                                    <Input
                                      id="confirm"
                                      value={confirmText}
                                      onChange={(e) => setConfirmText(e.target.value)}
                                      placeholder="SUPPRIMER"
                                      className="font-mono"
                                    />
                                    {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => { setConfirmText(""); setDeleteError(""); }}>
                                  Annuler
                                </AlertDialogCancel>
                                <Button
                                  variant="destructive"
                                  onClick={handleDeleteAccount}
                                  disabled={deleting || confirmText !== "SUPPRIMER"}
                                >
                                  {deleting ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Suppression...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Supprimer définitivement
                                    </>
                                  )}
                                </Button>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
