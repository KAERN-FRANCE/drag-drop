"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, AlertTriangle, Users, Link2, CreditCard, Plus, MoreHorizontal, Info, Loader2, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

const tabs = [
  { id: "company", label: "Entreprise", icon: Building2 },
  { id: "thresholds", label: "Seuils d'alerte", icon: AlertTriangle },
  { id: "users", label: "Utilisateurs", icon: Users },
  { id: "integrations", label: "Intégrations", icon: Link2 },
  { id: "billing", label: "Facturation", icon: CreditCard },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("company")
  const [useRegulatory, setUseRegulatory] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [companyData, setCompanyData] = useState({
    companyName: "",
    siret: "",
    address: "",
  })

  const [thresholds, setThresholds] = useState({
    dailyDriving: 8.5,
    dailyRest: 11.5,
    weeklyDriving: 52,
    amplitude: 12.5,
  })

  const [driversCount, setDriversCount] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        // Get company data from user_companies + companies tables
        const { data: userCompanyData } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        if (userCompanyData?.company_id) {
          // Fetch drivers count filtered by company
          const { count } = await supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('company_id', userCompanyData.company_id)
          setDriversCount(count || 0)

          const { data: companyInfo } = await supabase
            .from('companies')
            .select('name, siret')
            .eq('id', userCompanyData.company_id)
            .single()

          if (companyInfo) {
            setCompanyData({
              companyName: companyInfo.name || '',
              siret: companyInfo.siret || '',
              address: '',
            })
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSaveCompany = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          company_name: companyData.companyName,
          siret: companyData.siret,
          address: companyData.address,
        }
      })

      if (!error) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Error saving company:', error)
    } finally {
      setSaving(false)
    }
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
        <DashboardHeader breadcrumb="Paramètres" />
        <main className="p-6">
          <div className="mx-auto max-w-5xl">
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
                {activeTab === "company" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Informations générales</CardTitle>
                      <CardDescription>Gérez les informations de votre entreprise</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Nom de l'entreprise</Label>
                        <Input
                          id="companyName"
                          value={companyData.companyName}
                          onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
                          placeholder="Ex: Transport Express SARL"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siret">SIRET</Label>
                        <Input
                          id="siret"
                          value={companyData.siret}
                          onChange={(e) => setCompanyData({ ...companyData, siret: e.target.value })}
                          placeholder="Ex: 123 456 789 00012"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Adresse</Label>
                        <Input
                          id="address"
                          value={companyData.address}
                          onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                          placeholder="Ex: 123 Avenue du Transport, 75001 Paris"
                        />
                      </div>
                      <Button onClick={handleSaveCompany} disabled={saving}>
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

                {activeTab === "thresholds" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Personnaliser les seuils d'alerte</CardTitle>
                      <CardDescription>Recevez des alertes avant d'atteindre les seuils légaux</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div>
                          <p className="font-medium text-foreground">Utiliser les seuils réglementaires</p>
                          <p className="text-sm text-muted-foreground">
                            Alertes uniquement au dépassement des seuils légaux
                          </p>
                        </div>
                        <Switch checked={useRegulatory} onCheckedChange={setUseRegulatory} />
                      </div>

                      {!useRegulatory && (
                        <>
                          <Alert className="border-primary/20 bg-primary/5">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-foreground">
                              Les seuils légaux restent les limites absolues. Ces alertes personnalisées vous
                              préviennent avant d'atteindre les limites.
                            </AlertDescription>
                          </Alert>

                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Conduite journalière alerte à :</Label>
                                <span className="font-mono text-sm font-medium">
                                  {thresholds.dailyDriving}h (légal : 9h)
                                </span>
                              </div>
                              <Slider
                                value={[thresholds.dailyDriving]}
                                onValueChange={([value]) => setThresholds({ ...thresholds, dailyDriving: value })}
                                min={7}
                                max={9}
                                step={0.5}
                              />
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Repos journalier alerte à :</Label>
                                <span className="font-mono text-sm font-medium">
                                  {thresholds.dailyRest}h (légal : 11h min)
                                </span>
                              </div>
                              <Slider
                                value={[thresholds.dailyRest]}
                                onValueChange={([value]) => setThresholds({ ...thresholds, dailyRest: value })}
                                min={11}
                                max={13}
                                step={0.5}
                              />
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Conduite hebdomadaire alerte à :</Label>
                                <span className="font-mono text-sm font-medium">
                                  {thresholds.weeklyDriving}h (légal : 56h)
                                </span>
                              </div>
                              <Slider
                                value={[thresholds.weeklyDriving]}
                                onValueChange={([value]) => setThresholds({ ...thresholds, weeklyDriving: value })}
                                min={45}
                                max={56}
                                step={1}
                              />
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Amplitude journalière alerte à :</Label>
                                <span className="font-mono text-sm font-medium">
                                  {thresholds.amplitude}h (légal : 13h)
                                </span>
                              </div>
                              <Slider
                                value={[thresholds.amplitude]}
                                onValueChange={([value]) => setThresholds({ ...thresholds, amplitude: value })}
                                min={10}
                                max={13}
                                step={0.5}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <Button>Sauvegarder les seuils</Button>
                    </CardContent>
                  </Card>
                )}

                {activeTab === "users" && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Utilisateurs RH</CardTitle>
                          <CardDescription>Gérez les accès à la plateforme</CardDescription>
                        </div>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Inviter un utilisateur
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">Aucun utilisateur supplémentaire</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Invitez des collaborateurs pour gérer la flotte ensemble
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeTab === "integrations" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Intégrations</CardTitle>
                      <CardDescription>Connectez vos outils pour automatiser l'import des données</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Link2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">Aucune intégration disponible pour le moment</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fonctionnalité à venir
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeTab === "billing" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Facturation</CardTitle>
                      <CardDescription>Gérez votre abonnement et vos factures</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-border p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-foreground">Plan actuel</p>
                            <p className="text-sm text-muted-foreground">
                              {driversCount} chauffeur{driversCount > 1 ? 's' : ''} enregistré{driversCount > 1 ? 's' : ''}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-sm">
                            Version d'évaluation
                          </Badge>
                        </div>
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Contactez-nous pour en savoir plus sur nos offres entreprise.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
