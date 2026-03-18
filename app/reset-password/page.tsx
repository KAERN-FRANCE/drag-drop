"use client"

import Link from "next/link"
import { Truck, Lock, ArrowLeft, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  if (!token) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center space-y-2">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
        <p className="text-sm font-medium text-red-800">
          Lien invalide ou expiré.
        </p>
        <p className="text-xs text-red-600">
          Veuillez refaire une demande de réinitialisation.
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" size="sm" className="mt-2">
            Nouvelle demande
          </Button>
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }

    setLoading(true)

    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token,
      })

      if (res.error) {
        setError(res.error.message || "Erreur lors de la réinitialisation.")
      } else {
        setSuccess(true)
        setTimeout(() => router.push("/login"), 3000)
      }
    } catch (err: any) {
      setError("Le lien a expiré ou est invalide. Veuillez refaire une demande.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg bg-green-50 p-6 text-center space-y-2">
        <CheckCircle className="mx-auto h-8 w-8 text-green-600" />
        <p className="text-sm font-medium text-green-800">
          Mot de passe modifié avec succès !
        </p>
        <p className="text-xs text-green-600">
          Redirection vers la page de connexion...
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="pl-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmer le mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirm"
            type="password"
            placeholder="••••••••"
            className="pl-9"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Modification en cours...
          </>
        ) : (
          "Modifier le mot de passe"
        )}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">TachoCompliance</span>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
            <CardDescription>
              Définissez votre nouveau mot de passe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin" />}>
              <ResetPasswordForm />
            </Suspense>
            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" />
                Retour à la connexion
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
