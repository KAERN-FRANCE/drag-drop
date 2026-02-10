"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, User, Mail } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface EditDriverModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver: { id: number; name: string; user_id?: string } | null
  onDriverUpdated: () => void
}

export function EditDriverModal({ open, onOpenChange, driver, onDriverUpdated }: EditDriverModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loadingEmail, setLoadingEmail] = useState(false)

  useEffect(() => {
    if (driver && open) {
      setName(driver.name || "")
      setEmail("")
      setError("")
      setSuccess(false)

      // Récupérer l'email depuis Supabase Auth
      if (driver.user_id) {
        setLoadingEmail(true)
        fetch('/api/get-driver-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: driver.user_id }),
        })
          .then(res => res.json())
          .then(data => setEmail(data.email || ""))
          .finally(() => setLoadingEmail(false))
      }
    }
  }, [driver, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!driver) return
    setError("")
    setLoading(true)

    try {
      if (!name.trim()) {
        throw new Error("Le nom est obligatoire")
      }

      const initials = name.trim().split(" ").filter(n => n.length > 0).map(n => n[0]).join("").toUpperCase().slice(0, 2)

      const { error: updateError } = await supabase
        .from("drivers")
        .update({ name: name.trim(), initials })
        .eq("id", driver.id)

      if (updateError) throw new Error(updateError.message)

      setSuccess(true)
      setTimeout(() => {
        onDriverUpdated()
        onOpenChange(false)
        setSuccess(false)
      }, 800)
    } catch (err: any) {
      setError(err.message || "Une erreur s'est produite")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { setError(""); setSuccess(false); onOpenChange(v) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le chauffeur</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nom complet <span className="text-destructive">*</span></Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="edit-email"
                type="email"
                value={loadingEmail ? "Chargement..." : email}
                disabled
                className="pl-9 bg-muted"
              />
            </div>
            <p className="text-xs text-muted-foreground">L'email est lié au compte de connexion et ne peut pas être modifié ici.</p>
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
              <AlertDescription className="text-success">Chauffeur mis à jour !</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
