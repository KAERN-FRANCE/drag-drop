"use client"

import Link from "next/link"
import { Truck, Mail, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // La réinitialisation de mot de passe par email n'est pas encore configurée.
    // Contacter l'administrateur pour réinitialiser votre mot de passe.
    setSubmitted(true)
  }

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
            <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
            <CardDescription>
              Contactez votre administrateur pour réinitialiser votre mot de passe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitted ? (
              <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-800">
                Demande envoyée. Votre administrateur vous contactera prochainement.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Envoyer la demande
                </Button>
              </form>
            )}
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
