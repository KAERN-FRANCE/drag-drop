"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, CloudUpload, File, X, Loader2, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseChronoExcel, validateFileFormat, type ParsedChronoData } from "@/lib/file-parser"
import { calculerScoreConformite } from "@/lib/analyse-infractions"
import { detecterInfractionsChronologiques } from "@/lib/chrono-infractions"
import { CalendarDays } from "lucide-react"

type UploadState = "idle" | "parsing" | "selected" | "uploading" | "analyzing" | "complete" | "error"

/**
 * Convertit une date en format français vers ISO (YYYY-MM-DD)
 */
function parseFrenchDate(frenchDate: string): string {
  const moisFr: Record<string, string> = {
    'janv': '01', 'févr': '02', 'mars': '03', 'avr': '04',
    'mai': '05', 'juin': '06', 'juil': '07', 'août': '08',
    'sept': '09', 'oct': '10', 'nov': '11', 'déc': '12'
  }

  try {
    // Format attendu: "Ven. 28 Févr. 2025"
    const match = frenchDate.match(/(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})/i)
    if (match) {
      const jour = match[1].padStart(2, '0')
      const moisText = match[2].toLowerCase().substring(0, 4)
      const annee = match[3]
      const mois = moisFr[moisText] || '01'
      return `${annee}-${mois}-${jour}`
    }

    // Si c'est une semaine, retourner le lundi de cette semaine ISO
    if (frenchDate.includes('Semaine')) {
      const weekMatch = frenchDate.match(/Semaine\s+(\d+)\s+(\d{4})/)
      if (weekMatch) {
        const weekNum = parseInt(weekMatch[1])
        const year = parseInt(weekMatch[2])
        const jan4 = new Date(year, 0, 4)
        const dayOfWeek = jan4.getDay() || 7
        const monday = new Date(jan4)
        monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7)
        return monday.toISOString().split('T')[0]
      }
      const biWeekMatch = frenchDate.match(/Semaine\s+(\d+)\s+(\d{4})\s*\+/)
      if (biWeekMatch) {
        const weekNum = parseInt(biWeekMatch[1])
        const year = parseInt(biWeekMatch[2])
        const jan4 = new Date(year, 0, 4)
        const dayOfWeek = jan4.getDay() || 7
        const monday = new Date(jan4)
        monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7)
        return monday.toISOString().split('T')[0]
      }
    }

    return new Date().toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

export default function UploadPage() {
  const router = useRouter()
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [file, setFile] = useState<File | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string>("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showDriverError, setShowDriverError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [drivers, setDrivers] = useState<any[]>([])
  const [analysisResults, setAnalysisResults] = useState<any>(null)
  const [analysisId, setAnalysisId] = useState<number | null>(null)
  const [parsedData, setParsedData] = useState<ParsedChronoData | null>(null)
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState("")

  useEffect(() => {
    const fetchDrivers = async () => {
      const res = await fetch('/api/drivers', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setDrivers(json.drivers || [])
      }
    }
    fetchDrivers()
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const validation = validateFileFormat(acceptedFiles[0])
      if (!validation.valid) {
        setErrorMessage(validation.error || "Fichier non valide")
        setUploadState("error")
        return
      }
      setFile(acceptedFiles[0])
      setShowDriverError(false)
      setErrorMessage("")

      // Pré-parsing pour détecter la période du fichier
      setUploadState("parsing")
      try {
        const parsed = await parseChronoExcel(acceptedFiles[0])
        setParsedData(parsed)
        setPeriodStart(parsed.periodStart)
        setPeriodEnd(parsed.periodEnd)
        setUploadState("selected")
      } catch (err: any) {
        setErrorMessage(err?.message || "Erreur de lecture du fichier")
        setUploadState("error")
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxSize: 30 * 1024 * 1024,
    multiple: false,
  })

  const removeFile = () => {
    setFile(null)
    setUploadState("idle")
    setSelectedDriver("")
    setShowDriverError(false)
    setErrorMessage("")
    setParsedData(null)
    setPeriodStart("")
    setPeriodEnd("")
  }

  const startUpload = async () => {
    if (!selectedDriver) {
      setShowDriverError(true)
      return
    }

    if (!file || !parsedData) return

    try {
      setShowDriverError(false)
      setUploadState("uploading")
      setUploadProgress(0)

      setUploadProgress(10)

      // Filtrer les activités sur la période choisie
      const filteredActivities = parsedData.activities.filter(a => {
        const date = a.start.split('T')[0]
        return date >= periodStart && date <= periodEnd
      })

      console.log(`Activités filtrées: ${filteredActivities.length}/${parsedData.activities.length} (${periodStart} → ${periodEnd})`)

      setUploadProgress(30)
      setUploadState("analyzing")
      setUploadProgress(50)

      // Détecter les infractions avec le moteur chronologique
      const infractions = detecterInfractionsChronologiques(filteredActivities)
      console.log("Infractions détectées:", infractions.length)

      // Calculer le score
      const uniqueDays = new Set(filteredActivities.filter(a => a.type !== 'REST').map(a => a.start.split('T')[0]))
      const nbJours = uniqueDays.size
      const score = calculerScoreConformite(nbJours, infractions.length, infractions)
      console.log("Score calculé:", score)

      setUploadProgress(70)
      console.log("Période:", periodStart, "->", periodEnd)

      setUploadProgress(85)

      // Sauvegarder via l'API
      const infractionsData = infractions.map((inf: any) => ({
        type: inf.type,
        date: parseFrenchDate(inf.date),
        severity: inf.gravite === 'delit' ? 'critical' : inf.gravite === '5eme' ? 'high' : inf.gravite === '4eme' ? 'medium' : 'low',
        details: {
          code: inf.code,
          detail: inf.detail,
          valeur_constatee: inf.valeur_constatee,
          limite_reglementaire: inf.limite_reglementaire,
          gravite: inf.gravite,
          amende_min: inf.amende_min,
          amende_max: inf.amende_max,
          article_loi: inf.article_loi,
        }
      }))

      const saveRes = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driverId: parseInt(selectedDriver),
          periodStart,
          periodEnd,
          score,
          infractionsData,
          rawActivities: JSON.stringify(parsedData.activities),
        }),
      })

      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(errData.error || `Erreur de sauvegarde (${saveRes.status})`)
      }

      const saveData = await saveRes.json()
      const newAnalysisId = saveData.analysisId
      const finalScore = saveData.driverScore ?? score

      console.log("Analyse sauvegardée, ID:", newAnalysisId, "| Score:", finalScore)
      setAnalysisId(newAnalysisId)

      setUploadProgress(100)

      setAnalysisResults({
        score: finalScore,
        infractions: infractions.length,
        period: `${periodStart} - ${periodEnd}`
      })

      setUploadState("complete")
    } catch (error: any) {
      console.error('Erreur:', error)
      setErrorMessage(error?.message || "Erreur inconnue lors de l'analyse du fichier")
      setUploadState("error")
    }
  }

  const handleDriverChange = (value: string) => {
    setSelectedDriver(value)
    if (value) {
      setShowDriverError(false)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setUploadState("idle")
    setSelectedDriver("")
    setUploadProgress(0)
    setShowDriverError(false)
    setErrorMessage("")
    setAnalysisResults(null)
    setAnalysisId(null)
    setParsedData(null)
    setPeriodStart("")
    setPeriodEnd("")
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Uploader un fichier" />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
          <Card className="w-full max-w-xl">
            <CardContent className="p-8">
              {/* Idle State - Drag & Drop */}
              {uploadState === "idle" && (
                <div
                  {...getRootProps()}
                  className={cn(
                    "cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <input {...getInputProps()} />
                  <CloudUpload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium text-foreground">Glissez-déposez votre fichier ici</p>
                  <p className="mt-1 text-sm text-muted-foreground">ou cliquez pour parcourir</p>
                  <div className="mt-6 space-y-1 text-xs text-muted-foreground">
                    <p>Format accepté : XLSX, XLS, CSV (décompte chronologique)</p>
                    <p>Taille max : 30 Mo</p>
                  </div>
                </div>
              )}

              {/* Parsing State */}
              {uploadState === "parsing" && (
                <div className="space-y-6 text-center">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                  <div>
                    <p className="text-lg font-medium text-foreground">Lecture du fichier...</p>
                    <p className="text-sm text-muted-foreground">Détection de la période</p>
                  </div>
                </div>
              )}

              {/* Selected State - File Preview */}
              {uploadState === "selected" && file && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="rounded-lg bg-primary/10 p-3">
                      <File className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={removeFile}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Chauffeur concerné <span className="text-danger">*</span>
                    </label>
                    <Select value={selectedDriver} onValueChange={handleDriverChange}>
                      <SelectTrigger className={cn(showDriverError && "border-danger ring-danger/20 ring-2")}>
                        <SelectValue placeholder="Sélectionnez un chauffeur" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id.toString()}>
                            {driver.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {showDriverError && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Veuillez sélectionner un chauffeur avant de lancer l'analyse
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Sélecteur de période */}
                  {parsedData && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Période d'analyse
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Données disponibles du {new Date(parsedData.periodStart + 'T00:00:00').toLocaleDateString('fr-FR')} au {new Date(parsedData.periodEnd + 'T00:00:00').toLocaleDateString('fr-FR')} ({parsedData.rowCount} activités)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Date début</label>
                          <input
                            type="date"
                            value={periodStart}
                            min={parsedData.periodStart}
                            max={periodEnd || parsedData.periodEnd}
                            onChange={(e) => setPeriodStart(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Date fin</label>
                          <input
                            type="date"
                            value={periodEnd}
                            min={periodStart || parsedData.periodStart}
                            max={parsedData.periodEnd}
                            onChange={(e) => setPeriodEnd(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button className="w-full" size="lg" onClick={startUpload}>
                    <Upload className="mr-2 h-4 w-4" />
                    Lancer l'analyse
                  </Button>
                </div>
              )}

              {/* Uploading State */}
              {uploadState === "uploading" && (
                <div className="space-y-6 text-center">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                  <div>
                    <p className="text-lg font-medium text-foreground">Lecture du fichier...</p>
                    <p className="text-sm text-muted-foreground">{uploadProgress}%</p>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Analyzing State */}
              {uploadState === "analyzing" && (
                <div className="space-y-6 text-center">
                  <div className="relative mx-auto h-16 w-16">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">Analyse en cours...</p>
                    <p className="mt-2 text-sm text-muted-foreground">Détection des infractions...</p>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Complete State */}
              {uploadState === "complete" && analysisResults && (
                <div className="space-y-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">Analyse terminée avec succès !</p>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-left">
                    <h4 className="font-medium text-foreground">Résumé</h4>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Infractions détectées</span>
                        <span className="font-mono font-semibold text-danger">{analysisResults.infractions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Score de conformité</span>
                        <span className={cn("font-mono font-semibold", analysisResults.score >= 80 ? "text-success" : analysisResults.score >= 60 ? "text-warning" : "text-danger")}>
                          {analysisResults.score}/100
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Période analysée</span>
                        <span className="font-medium">{analysisResults.period}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {analysisId && (
                      <Button className="flex-1" onClick={() => router.push(`/analyses/${analysisId}`)}>
                        Voir l'analyse complète
                      </Button>
                    )}
                    <Button variant="outline" onClick={resetUpload}>
                      Nouveau fichier
                    </Button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {uploadState === "error" && (
                <div className="space-y-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
                    <AlertTriangle className="h-8 w-8 text-danger" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">Erreur lors de l'analyse</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {errorMessage || "Le format du fichier n'est pas reconnu. Veuillez vérifier que le fichier est un décompte chronologique."}
                    </p>
                  </div>
                  <Button onClick={resetUpload}>Réessayer</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
