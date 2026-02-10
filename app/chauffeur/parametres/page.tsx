"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DriverHeader } from "@/components/driver/driver-header"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Trash2, AlertTriangle, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function DriverSettingsPage() {
    const router = useRouter()

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

    const handlePasswordChange = async () => {
        setPasswordError("")
        setPasswordSuccess(false)

        // Validation
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
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/login')
                return
            }

            const { data: driverData } = await supabase
                .from('drivers')
                .select('id')
                .eq('user_id', user.id)
                .single()

            if (driverData) {
                await supabase.from('infractions').delete().eq('driver_id', driverData.id)
                await supabase.from('analyses').delete().eq('driver_id', driverData.id)
                await supabase.from('drivers').delete().eq('id', driverData.id)
            }

            await supabase.auth.signOut()
            localStorage.clear()
            router.push('/')

        } catch (error) {
            console.error('Error deleting account:', error)
            setDeleteError("Une erreur est survenue lors de la suppression")
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <DriverHeader
                title="Paramètres"
                subtitle="Gérez les paramètres de votre compte"
            />

            <div className="p-6 space-y-6 max-w-3xl">
                {/* Password Change */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-primary" />
                            <CardTitle className="text-base">Modifier mon mot de passe</CardTitle>
                        </div>
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
                                <>
                                    <Lock className="mr-2 h-4 w-4" />
                                    Modifier le mot de passe
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* GDPR - Delete Account */}
                <Card className="border-danger/50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-danger" />
                            <CardTitle className="text-base text-danger">Zone de danger</CardTitle>
                        </div>
                        <CardDescription>Actions irréversibles sur votre compte</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 rounded-lg bg-danger/5 border border-danger/20">
                            <h3 className="font-medium text-foreground">Supprimer mon compte</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Conformément au RGPD, vous avez le droit de supprimer vos données. Cette action supprimera :
                            </p>
                            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                                <li>Votre profil chauffeur</li>
                                <li>Toutes vos analyses et infractions</li>
                                <li>Votre historique complet</li>
                            </ul>

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
                                            <p>
                                                Cette action est <strong>irréversible</strong>. Toutes vos données seront
                                                définitivement supprimées.
                                            </p>
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

                {/* GDPR Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Vos droits RGPD</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <p><strong>Droit d'accès</strong> - Consultez vos données depuis votre profil.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <p><strong>Droit de rectification</strong> - Modifiez vos informations depuis votre profil.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <p><strong>Droit à l'effacement</strong> - Supprimez votre compte ci-dessus.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            <p><strong>Droit à la portabilité</strong> - Contactez-nous pour vos données.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
