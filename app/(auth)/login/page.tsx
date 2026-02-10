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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mail, Lock, Eye, EyeOff, Loader2, Building2, User, Shield, TruckIcon } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userType, setUserType] = useState<"admin" | "driver">("admin")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
    // Driver specific
    driverCode: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (userType === "admin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (error) throw error
        router.push("/dashboard")
      } else {
        // For drivers, we might want a different auth flow or just simple login for now
        // Assuming drivers also have email/password for this demo
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email || formData.driverCode, // Fallback if they use email in driver code field
          password: formData.password,
        })

        if (error) throw error
        router.push("/chauffeur")
      }
    } catch (error) {
      console.error("Login error:", error)
      // You might want to show a toast here
      alert("Erreur de connexion. Vérifiez vos identifiants.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Connexion</CardTitle>
        <CardDescription>Accédez à votre espace TachoCompliance</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={userType} onValueChange={(v) => setUserType(v as "admin" | "driver")} className="mb-6">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {userType === "driver" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="driverCode">Code chauffeur ou Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="driverCode"
                    type="text"
                    placeholder="ABC123 ou email@exemple.fr"
                    className="pl-9"
                    value={formData.driverCode || formData.email}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.includes("@")) {
                        setFormData({ ...formData, email: value, driverCode: "" })
                      } else {
                        setFormData({ ...formData, driverCode: value, email: "" })
                      }
                    }}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Utilisez le code fourni par votre entreprise ou votre email
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email professionnel</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@entreprise.fr"
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
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
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={formData.rememberMe}
                onCheckedChange={(checked) => setFormData({ ...formData, rememberMe: checked as boolean })}
              />
              <Label htmlFor="remember" className="text-sm font-normal">
                Se souvenir de moi
              </Label>
            </div>
            <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary">
              Mot de passe oublié ?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                {userType === "admin" ? <Shield className="mr-2 h-4 w-4" /> : <TruckIcon className="mr-2 h-4 w-4" />}
                {userType === "admin" ? "Accéder au tableau de bord" : "Accéder à mon espace"}
              </>
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        {userType === "admin" ? (
          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Créer un compte entreprise
            </Link>
          </p>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Vous n'avez pas de code chauffeur ?</p>
            <p className="text-sm text-muted-foreground">
              Contactez votre responsable RH pour obtenir vos identifiants.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
