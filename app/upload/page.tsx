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
import { supabase } from "@/lib/supabase"
import { getUserCompanyId } from "@/lib/company"
import { parseFile, validateFileFormat } from "@/lib/file-parser"
import { extraireDonneesAnalyse, detecterInfractions, calculerScoreConformite } from "@/lib/analyse-infractions"
import { corrigerAnneesInfractions } from "@/lib/date-corrections"
import { isC1BFile, convertC1BToLigneRaw, C1BParseResponse } from "@/lib/c1b-transformer"

type UploadState = "idle" | "selected" | "uploading" | "analyzing" | "complete" | "error"

/**
 * Convertit une date en format français vers ISO (YYYY-MM-DD)
 * @param frenchDate - Date au format "Ven. 28 Févr. 2025" ou "Semaine 40 2024"
 * @param contextYear - Année de référence pour les dates sans année explicite
 * @param contextMonth - Mois de référence pour détecter les transitions d'année
 * @returns Date au format ISO ou date actuelle si parsing échoue
 */
function parseFrenchDate(frenchDate: string, contextYear?: number, contextMonth?: number): string {
  // Mapping des mois français
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

    // Format sans année: "Lun. 16 Janv."
    const matchSansAnnee = frenchDate.match(/(\d{1,2})\s+([a-zéû]+)\.?/i)
    if (matchSansAnnee) {
      const jour = matchSansAnnee[1].padStart(2, '0')
      const moisText = matchSansAnnee[2].toLowerCase().substring(0, 4)
      const moisNum = parseInt(moisFr[moisText] || '01')

      // Déterminer l'année en fonction du contexte
      let annee = contextYear || new Date().getFullYear()

      // Si on a un mois de contexte et que le mois actuel est "avant" le contexte
      // (ex: contexte = septembre (09), mois actuel = janvier (01))
      // alors on est probablement passé à l'année suivante
      if (contextMonth && moisNum < contextMonth && contextMonth >= 7) {
        // Si le contexte est dans la deuxième moitié de l'année (>=7)
        // et le mois actuel est dans la première moitié (<7)
        // alors on incrémente l'année
        if (moisNum <= 6) {
          annee++
        }
      }

      const mois = moisNum.toString().padStart(2, '0')
      return `${annee}-${mois}-${jour}`
    }

    // Si c'est une semaine, retourner le lundi de cette semaine ISO
    if (frenchDate.includes('Semaine')) {
      const weekMatch = frenchDate.match(/Semaine\s+(\d+)\s+(\d{4})/)
      if (weekMatch) {
        const weekNum = parseInt(weekMatch[1])
        const year = parseInt(weekMatch[2])
        // Calcul du lundi de la semaine ISO
        const jan4 = new Date(year, 0, 4)
        const dayOfWeek = jan4.getDay() || 7
        const monday = new Date(jan4)
        monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7)
        return monday.toISOString().split('T')[0]
      }
      // Format "Semaine X YYYY + Semaine Y YYYY" (infractions bi-hebdo)
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

    // Fallback: date actuelle
    return new Date().toISOString().split('T')[0]
  } catch (error) {
    console.error('Erreur de parsing de date:', frenchDate, error)
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
  const [c1bDriverName, setC1bDriverName] = useState<string | null>(null)

  // Fetch drivers from Supabase (filtered by company)
  useEffect(() => {
    const fetchDrivers = async () => {
      const companyId = await getUserCompanyId()
      let query = supabase.from('drivers').select('id, name').order('name')
      if (companyId) query = query.eq('company_id', companyId)
      const { data } = await query
      if (data) {
        setDrivers(data)
      }
    }
    fetchDrivers()
  }, [])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const validation = validateFileFormat(acceptedFiles[0])
      if (!validation.valid) {
        setErrorMessage(validation.error || "Fichier non valide")
        setUploadState("error")
        return
      }
      setFile(acceptedFiles[0])
      setUploadState("selected")
      setShowDriverError(false)
      setErrorMessage("")
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/octet-stream": [".c1b", ".ddd", ".v1b"],
    },
    maxSize: 30 * 1024 * 1024, // 30MB
    multiple: false,
  })

  const removeFile = () => {
    setFile(null)
    setUploadState("idle")
    setSelectedDriver("")
    setShowDriverError(false)
    setErrorMessage("")
  }

  const startUpload = async () => {
    if (!selectedDriver) {
      setShowDriverError(true)
      return
    }

    if (!file) return

    try {
      setShowDriverError(false)
      setUploadState("uploading")
      setUploadProgress(0)

      const companyId = await getUserCompanyId()

      console.log("📄 Début du parsing du fichier:", file.name)
      setUploadProgress(10)

      let lignesRaw
      const fileIsC1B = isC1BFile(file.name)

      if (fileIsC1B) {
        // ===== FLUX C1B =====
        console.log("🔧 Fichier C1B détecté, envoi au parser Python...")

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/parse-c1b', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erreur du parser C1B' }))
          throw new Error(errorData.error || `Erreur du parser C1B (${response.status})`)
        }

        const c1bData: C1BParseResponse = await response.json()
        console.log("✅ C1B parsé:", c1bData.drivers_found, "conducteur(s),", c1bData.results[0]?.activities?.length, "activités")

        if (!c1bData.results || c1bData.results.length === 0) {
          throw new Error("Aucune donnée trouvée dans le fichier C1B")
        }

        // Prendre le premier conducteur
        const driverResult = c1bData.results[0]
        setC1bDriverName(driverResult.driver_name)

        // Transformer les activités en LigneRaw
        lignesRaw = convertC1BToLigneRaw(driverResult)
        console.log("✅ Transformation C1B → LigneRaw:", lignesRaw.length, "lignes")
      } else {
        // ===== FLUX EXCEL/CSV =====
        let parsedData
        try {
          parsedData = await parseFile(file)
          console.log("✅ Parsing réussi:", parsedData.rowCount, "lignes")
        } catch (parseError: any) {
          console.error("❌ Erreur de parsing:", parseError)
          throw new Error(`Erreur de parsing: ${parseError.message}`)
        }
        lignesRaw = parsedData.data
      }

      setUploadProgress(30)

      // Étape 2: Analyser les données (algorithme commun pour les 2 flux)
      setUploadState("analyzing")
      setUploadProgress(50)

      console.log("🔍 Début de l'analyse des données")
      let journees, semaines, infractions, score

      try {
        const extracted = extraireDonneesAnalyse(lignesRaw)
        journees = extracted.journees
        semaines = extracted.semaines
        console.log("✅ Extraction:", journees.length, "journées,", semaines.length, "semaines")
      } catch (extractError: any) {
        console.error("❌ Erreur d'extraction:", extractError)
        throw new Error(`Erreur d'extraction: ${extractError.message}`)
      }

      try {
        infractions = detecterInfractions(journees, semaines)
        console.log("✅ Détection:", infractions.length, "infractions")

        // Corriger les années si nécessaire (transition d'année)
        const infractionsCorrigees = corrigerAnneesInfractions(infractions)
        const nbCorrections = infractionsCorrigees.filter((inf, i) => inf.date !== infractions[i]?.date).length
        if (nbCorrections > 0) {
          console.log("🔧 Correction automatique de", nbCorrections, "dates (transition d'année)")
          infractions = infractionsCorrigees
        }
      } catch (detectError: any) {
        console.error("❌ Erreur de détection:", detectError)
        throw new Error(`Erreur de détection: ${detectError.message}`)
      }

      try {
        score = calculerScoreConformite(journees.length, infractions.length, infractions)
        console.log("✅ Score calculé:", score)
      } catch (scoreError: any) {
        console.error("❌ Erreur de calcul de score:", scoreError)
        throw new Error(`Erreur de calcul: ${scoreError.message}`)
      }

      setUploadProgress(70)

      // Étape 3: Stocker dans Supabase
      console.log("💾 Début du stockage dans Supabase")

      // 3.1: Créer l'analyse
      const firstJournee = journees[0]
      const lastJournee = journees[journees.length - 1]

      // Convertir les dates du format français vers un format ISO
      const periodStart = parseFrenchDate(firstJournee?.date || '')
      const periodEnd = parseFrenchDate(lastJournee?.date || '')

      console.log("📅 Période:", periodStart, "->", periodEnd)

      let analysisData
      try {
        const { data, error: analysisError } = await supabase
          .from('analyses')
          .insert({
            driver_id: parseInt(selectedDriver),
            company_id: companyId ? parseInt(companyId) : null,
            period_start: periodStart,
            period_end: periodEnd,
            score: score,
            status: 'completed'
          })
          .select()
          .single()

        if (analysisError) {
          console.error("❌ Erreur Supabase (analyse):", analysisError)
          throw new Error(`Erreur base de données: ${analysisError.message}`)
        }

        analysisData = data
        console.log("✅ Analyse créée, ID:", analysisData.id)
      } catch (dbError: any) {
        console.error("❌ Erreur lors de la création de l'analyse:", dbError)
        throw new Error(`Erreur de création d'analyse: ${dbError.message}`)
      }

      setUploadProgress(85)

      // 3.2: Insérer les infractions
      if (infractions.length > 0) {
        console.log("📝 Insertion de", infractions.length, "infractions")

        try {
          const infractionsToInsert = infractions.map(inf => ({
            driver_id: parseInt(selectedDriver),
            company_id: companyId ? parseInt(companyId) : null,
            analysis_id: analysisData.id,
            date: parseFrenchDate(inf.date),
            type: inf.type,
            severity: inf.gravite === 'delit' ? 'critical' : inf.gravite === '5eme' ? 'high' : inf.gravite === '4eme' ? 'medium' : 'low'
          }))

          const { error: infractionsError } = await supabase
            .from('infractions')
            .insert(infractionsToInsert)

          if (infractionsError) {
            console.error("❌ Erreur Supabase (infractions):", infractionsError)
            throw new Error(`Erreur d'insertion des infractions: ${infractionsError.message}`)
          }

          console.log("✅ Infractions insérées")
        } catch (infError: any) {
          console.error("❌ Erreur lors de l'insertion des infractions:", infError)
          throw new Error(`Erreur d'insertion: ${infError.message}`)
        }
      }

      setUploadProgress(95)

      // 3.3: Recalculer le score du chauffeur sur les 12 derniers mois
      try {
        const dateLimit12m = new Date()
        dateLimit12m.setMonth(dateLimit12m.getMonth() - 12)
        const dateLimitStr = dateLimit12m.toISOString().split('T')[0]

        const { data: allInfractions12m } = await supabase
          .from('infractions')
          .select('severity')
          .eq('driver_id', parseInt(selectedDriver))
          .gte('date', dateLimitStr)

        const penalites: Record<string, number> = { critical: 5, high: 2, medium: 1, low: 0 }
        let globalScore = 100
        ;(allInfractions12m || []).forEach((inf: any) => {
          globalScore -= penalites[inf.severity] || 5
        })
        globalScore = Math.max(0, Math.min(100, globalScore))

        const { error: updateError } = await supabase
          .from('drivers')
          .update({ score: globalScore })
          .eq('id', parseInt(selectedDriver))

        if (updateError) {
          console.error("❌ Erreur Supabase (update driver):", updateError)
          throw new Error(`Erreur de mise à jour du score: ${updateError.message}`)
        }

        // Mettre à jour le score affiché avec le score global
        score = globalScore
        console.log("✅ Score du chauffeur recalculé (12 mois):", globalScore)
      } catch (updateErr: any) {
        console.error("❌ Erreur lors de la mise à jour du chauffeur:", updateErr)
        throw new Error(`Erreur de mise à jour: ${updateErr.message}`)
      }

      setUploadProgress(100)

      // Stocker les résultats pour l'affichage
      setAnalysisResults({
        score,
        infractions: infractions.length,
        period: `${periodStart} - ${periodEnd}`
      })
      setAnalysisId(analysisData.id)

      console.log("🎉 Analyse terminée avec succès!")
      setUploadState("complete")
    } catch (error: any) {
      console.error('❌ ERREUR GÉNÉRALE:', error)
      console.error('Type:', typeof error)
      console.error('Message:', error?.message)
      console.error('Stack:', error?.stack)
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
    setC1bDriverName(null)
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
                    <p>Formats acceptés : XLSX, XLS, CSV, C1B, DDD, V1B</p>
                    <p>Taille max : 30 Mo</p>
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                        {isC1BFile(file.name) && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Tachygraphe C1B
                          </span>
                        )}
                      </div>
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
                    <p className="text-lg font-medium text-foreground">
                      {file && isC1BFile(file.name) ? "Décodage du fichier tachygraphe..." : "Lecture du fichier..."}
                    </p>
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
                      {c1bDriverName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Conducteur (carte)</span>
                          <span className="font-medium">{c1bDriverName}</span>
                        </div>
                      )}
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
                      {errorMessage || "Le format du fichier n'est pas reconnu. Veuillez vérifier que le fichier provient bien d'un chronotachygraphe."}
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
