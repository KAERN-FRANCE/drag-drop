"use client"

import { useState } from "react"
import { getUserCompanyId } from "@/lib/company"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Mail, Lock, User } from "lucide-react"

interface AddDriverModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onDriverAdded: () => void
}

export function AddDriverModal({ open, onOpenChange, onDriverAdded }: AddDriverModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess(false)
        setLoading(true)

        try {
            if (!formData.fullName.trim()) {
                throw new Error("Le nom est obligatoire")
            }
            if (!formData.email.trim()) {
                throw new Error("L'email est obligatoire")
            }
            if (formData.password.length < 6) {
                throw new Error("Le mot de passe doit contenir au moins 6 caractères")
            }

            const companyId = await getUserCompanyId()
            if (!companyId) {
                throw new Error("Impossible de trouver votre entreprise. Veuillez vous reconnecter.")
            }

            const response = await fetch('/api/create-driver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.fullName.trim(),
                    email: formData.email.trim().toLowerCase(),
                    password: formData.password,
                    companyId,
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || "Erreur lors de la création du chauffeur")
            }

            setSuccess(true)
            setFormData({ fullName: "", email: "", password: "" })

            setTimeout(() => {
                onDriverAdded()
                onOpenChange(false)
                setSuccess(false)
            }, 1000)

        } catch (err: any) {
            console.error('Error creating driver:', err)
            setError(err.message || "Une erreur s'est produite")
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (!loading) {
            setFormData({ fullName: "", email: "", password: "" })
            setError("")
            setSuccess(false)
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Ajouter un chauffeur</DialogTitle>
                    <DialogDescription>
                        Créez un compte chauffeur avec ses identifiants de connexion.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">
                            Nom complet <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="fullName"
                                placeholder="Pierre DUPONT"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                disabled={loading}
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">
                            Email <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="pierre.dupont@email.fr"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={loading}
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">
                            Mot de passe <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="password"
                                type="password"
                                placeholder="Min. 6 caractères"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                disabled={loading}
                                className="pl-9"
                                required
                                minLength={6}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Le chauffeur utilisera cet email et ce mot de passe pour se connecter.
                        </p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="border-success bg-success/10">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <AlertDescription className="text-success">
                                Chauffeur créé avec succès !
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1"
                        >
                            Annuler
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Créer le chauffeur
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
