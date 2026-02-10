"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building2,
  Hash,
  Users,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
  TruckIcon,
  Phone,
  CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function RegisterPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<"admin" | "driver">("admin")
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    // Admin - Step 1
    companyName: "",
    siret: "",
    driverCount: "",
    // Admin - Step 2 & Driver
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    // Driver specific
    companyCode: "",
    driverLicense: "",
  })

  const passwordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const strength = passwordStrength(formData.password)

  const getStrengthColor = (s: number) => {
    if (s <= 1) return "bg-danger"
    if (s <= 2) return "bg-warning"
    if (s <= 3) return "bg-success/70"
    return "bg-success"
  }

  const getStrengthText = (s: number) => {
    if (s <= 1) return "Faible"
    if (s <= 2) return "Moyen"
    if (s <= 3) return "Bon"
    return "Excellent"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (userType === "admin" && step === 1) {
      setStep(2)
      return
    }

    setIsLoading(true)

    try {
      console.log("🚀 Début de l'inscription...")
      console.log("📧 Email:", formData.email)
      console.log("👤 Type:", userType)

      // Create user account with Supabase
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            user_type: userType,
          },
        },
      })

      console.log("📝 Réponse Auth:", authData)

      if (signUpError) {
        console.error("❌ Erreur signUp:", signUpError)
        throw signUpError
      }

      if (!authData.user) {
        console.error("❌ Pas d'utilisateur créé")
        throw new Error("User creation failed")
      }

      console.log("✅ Utilisateur créé:", authData.user.id)
      console.log("📧 Email utilisateur:", authData.user.email)

      // If admin, create company and link user using Postgres function
      if (userType === "admin") {
        console.log("🏢 Création de l'entreprise...")
        console.log("📊 Données entreprise:", {
          name: formData.companyName,
          siret: formData.siret,
          driver_count: formData.driverCount,
          user_id: authData.user.id
        })

        // Use PostgreSQL function to atomically create company and link user
        // This bypasses RLS issues during registration
        const { data: registerData, error: registerError } = await supabase.rpc("register_company_admin", {
          p_company_name: formData.companyName,
          p_siret: formData.siret,
          p_driver_count: formData.driverCount,
          p_user_id: authData.user.id,
        })

        console.log("📝 Réponse register_company_admin:", registerData)

        if (registerError) {
          console.error("❌ Erreur fonction registration:", registerError)
          console.error("❌ Code:", registerError.code)
          console.error("❌ Message:", registerError.message)
          console.error("❌ Details:", registerError.details)
          throw registerError
        }

        // Check if registration was successful
        if (!registerData || registerData.length === 0) {
          console.error("❌ Pas de données retournées par register_company_admin")
          throw new Error("La création de l'entreprise a échoué")
        }

        const result = registerData[0]
        console.log("📋 Résultat:", result)

        if (!result.success) {
          console.error("❌ Échec création entreprise:", result.message)
          throw new Error(result.message || "Erreur lors de la création de l'entreprise")
        }

        console.log("✅ Company created successfully!")
        console.log("🆔 Company ID:", result.company_id)
        console.log("🚀 Redirection vers /dashboard...")
        router.push("/dashboard")
      } else {
        // For drivers, find company by code and link
        // TODO: Implement company code lookup
        // For now, drivers need to be invited by their company
        setError("L'inscription chauffeur doit se faire via une invitation de votre entreprise.")
        return
      }
    } catch (err: any) {
      console.error("Registration error:", err)
      setError(err.message || "Une erreur est survenue lors de l'inscription. Veuillez réessayer.")
    } finally {
      setIsLoading(false)
    }
  }

  const isAdminStep1Valid = formData.companyName && formData.siret && formData.driverCount
  const isAdminStep2Valid =
    formData.firstName &&
    formData.lastName &&
    formData.email &&
    formData.password &&
    formData.password === formData.confirmPassword &&
    formData.acceptTerms &&
    strength >= 2

  const isDriverValid =
    formData.companyCode &&
    formData.firstName &&
    formData.lastName &&
    formData.email &&
    formData.password &&
    formData.password === formData.confirmPassword &&
    formData.acceptTerms &&
    strength >= 2

  const totalSteps = userType === "admin" ? 2 : 1

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Créer votre compte</CardTitle>
        <CardDescription>Rejoignez TachoCompliance</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-danger bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}
        <Tabs
          value={userType}
          onValueChange={(v) => {
            setUserType(v as "admin" | "driver")
            setStep(1)
          }}
          className="mb-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Entreprise / RH
            </TabsTrigger>
            <TabsTrigger value="driver" className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4" />
              Chauffeur
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Steps indicator for admin */}
        {userType === "admin" && (
          <div className="mb-6 flex items-center justify-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {step > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <div className={cn("h-0.5 w-12", step > 1 ? "bg-primary" : "bg-muted")} />
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              2
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ADMIN REGISTRATION */}
          {userType === "admin" && step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nom de l'entreprise *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="Transport Dupont SA"
                    className="pl-9"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siret">SIRET *</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="siret"
                    placeholder="123 456 789 00012"
                    className="pl-9"
                    value={formData.siret}
                    onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverCount">Nombre de chauffeurs *</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                  <Select
                    value={formData.driverCount}
                    onValueChange={(value) => setFormData({ ...formData, driverCount: value })}
                  >
                    <SelectTrigger className="pl-9">
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-5">1 à 5 chauffeurs</SelectItem>
                      <SelectItem value="6-20">6 à 20 chauffeurs</SelectItem>
                      <SelectItem value="21-50">21 à 50 chauffeurs</SelectItem>
                      <SelectItem value="51+">Plus de 50 chauffeurs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!isAdminStep1Valid}>
                Continuer
              </Button>
            </>
          )}

          {userType === "admin" && step === 2 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder="Marie"
                      className="pl-9"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    placeholder="Lefebvre"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email professionnel *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="marie.lefebvre@transport-dupont.fr"
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1.5 flex-1 rounded-full",
                            i <= strength ? getStrengthColor(strength) : "bg-muted",
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Force du mot de passe : {getStrengthText(strength)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                  {formData.confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {formData.password === formData.confirmPassword ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-danger" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked as boolean })}
                />
                <Label htmlFor="terms" className="text-sm font-normal leading-relaxed">
                  J'accepte les{" "}
                  <Link href="/cgu" className="text-primary hover:underline">
                    conditions générales d'utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    politique de confidentialité
                  </Link>
                </Label>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                  Retour
                </Button>
                <Button type="submit" className="flex-1" disabled={!isAdminStep2Valid || isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer mon compte entreprise"
                  )}
                </Button>
              </div>
            </>
          )}

          {/* DRIVER REGISTRATION */}
          {userType === "driver" && (
            <>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-4">
                <p className="text-sm text-foreground">
                  <strong>Important :</strong> Pour créer un compte chauffeur, vous devez avoir reçu un{" "}
                  <strong>code entreprise</strong> de votre employeur.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyCode">Code entreprise *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="companyCode"
                    placeholder="EX: TRANSP-2024-ABC"
                    className="pl-9 font-mono"
                    value={formData.companyCode}
                    onChange={(e) => setFormData({ ...formData, companyCode: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Code fourni par votre entreprise</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="driverFirstName">Prénom *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="driverFirstName"
                      placeholder="Pierre"
                      className="pl-9"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverLastName">Nom *</Label>
                  <Input
                    id="driverLastName"
                    placeholder="Durand"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverEmail">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="driverEmail"
                    type="email"
                    placeholder="pierre.durand@email.fr"
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverPhone">Téléphone (optionnel)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="driverPhone"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    className="pl-9"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverLicense">N° Permis de conduire (optionnel)</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="driverLicense"
                    placeholder="12AB34567"
                    className="pl-9 font-mono"
                    value={formData.driverLicense}
                    onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverPassword">Mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="driverPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1.5 flex-1 rounded-full",
                            i <= strength ? getStrengthColor(strength) : "bg-muted",
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Force du mot de passe : {getStrengthText(strength)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverConfirmPassword">Confirmer le mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="driverConfirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                  {formData.confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {formData.password === formData.confirmPassword ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-danger" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="driverTerms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked as boolean })}
                />
                <Label htmlFor="driverTerms" className="text-sm font-normal leading-relaxed">
                  J'accepte les{" "}
                  <Link href="/cgu" className="text-primary hover:underline">
                    conditions générales d'utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    politique de confidentialité
                  </Link>
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={!isDriverValid || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <TruckIcon className="mr-2 h-4 w-4" />
                    Créer mon compte chauffeur
                  </>
                )}
              </Button>
            </>
          )}
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
