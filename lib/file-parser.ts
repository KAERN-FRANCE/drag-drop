/**
 * Parser pour fichiers Excel chronologiques (décompte chronologique)
 * Format attendu : Jour | Début | Fin | Durée | Séquence | Conduite | Travail | Dispo | Coupure
 */

import * as XLSX from 'xlsx';
import { Activity } from '@/types';

export interface ParsedChronoData {
  activities: Activity[]
  periodStart: string  // YYYY-MM-DD
  periodEnd: string    // YYYY-MM-DD
  fileName: string
  rowCount: number
}

// Mapping mois français abrégés → numéro (0-indexed)
const MOIS_MAP: Record<string, number> = {
  'jan': 0, 'fev': 1, 'fév': 1, 'feb': 1,
  'mar': 2, 'avr': 3, 'apr': 3,
  'mai': 4, 'may': 4, 'jun': 5, 'jui': 5,
  'jul': 6, 'juil': 6, 'aou': 7, 'aoû': 7, 'aug': 7,
  'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11, 'déc': 11,
}

// Mapping séquence → Activity type
const SEQUENCE_MAP: Record<string, Activity['type']> = {
  'conduite': 'DRIVING',
  'travail': 'WORK',
  'repos': 'REST',
  'coupure': 'REST',
  'dispo': 'AVAILABILITY',
  'disponibilité': 'AVAILABILITY',
  'disponibilite': 'AVAILABILITY',
  'autre': 'UNKNOWN',
}

/**
 * Normalise un nom de colonne (retire accents, lowercase, trim)
 */
function normalizeColName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Trouve une colonne par nom normalisé parmi les colonnes disponibles
 */
function findColumn(headers: string[], ...candidates: string[]): string | null {
  const normalizedCandidates = candidates.map(normalizeColName)
  for (const header of headers) {
    if (normalizedCandidates.includes(normalizeColName(header))) {
      return header
    }
  }
  return null
}

/**
 * Parse une date française "Lun. 02 Mar. 2026" → { year, month, day }
 */
function parseFrenchJour(jourStr: string): { year: number; month: number; day: number } | null {
  if (!jourStr || typeof jourStr !== 'string') return null

  // Pattern : "Lun. 02 Mar. 2026" ou "02 Mar. 2026" ou "Lun 02 Mars 2026"
  const match = jourStr.match(/(\d{1,2})\s+([A-Za-zéûÉÛàÀ]+)\.?\s+(\d{4})/)
  if (!match) return null

  const day = parseInt(match[1], 10)
  const moisText = match[2].toLowerCase().substring(0, 3)
  const year = parseInt(match[3], 10)

  const month = MOIS_MAP[moisText]
  if (month === undefined) return null

  return { year, month, day }
}

/**
 * Parse un temps HH:MM → { hours, minutes }
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) }
}

/**
 * Construit un timestamp ISO en Europe/Paris à partir d'une date + heure
 */
function buildTimestamp(year: number, month: number, day: number, hours: number, minutes: number): string {
  // Construire la date en UTC puis ajuster pour Europe/Paris
  // On utilise une approche simple : créer la date locale et formatter en ISO
  const d = new Date(year, month, day, hours, minutes, 0)
  // Formatter comme ISO avec le timezone offset local
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`
}

/**
 * Ajoute N jours à une date { year, month, day }
 */
function addDays(date: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const d = new Date(date.year, date.month, date.day + days)
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

/**
 * Parse un fichier Excel chronologique et retourne des Activity[]
 */
export async function parseChronoExcel(file: File): Promise<ParsedChronoData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('Impossible de lire le fichier'))
          return
        }

        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        // Convertir en JSON avec headers
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet)

        if (!rows || rows.length === 0) {
          reject(new Error('Le fichier est vide ou mal formaté'))
          return
        }

        // Détecter les colonnes
        const headers = Object.keys(rows[0])
        const colJour = findColumn(headers, 'Jour', 'Date', 'Journée', 'Journee')
        const colDebut = findColumn(headers, 'Début', 'Debut', 'Heure début', 'Start')
        const colFin = findColumn(headers, 'Fin', 'Heure fin', 'End')
        const colSequence = findColumn(headers, 'Séquence', 'Sequence', 'Activité', 'Activite', 'Type')

        // Validation des colonnes requises
        const missing: string[] = []
        if (!colJour) missing.push('Jour')
        if (!colDebut) missing.push('Début')
        if (!colFin) missing.push('Fin')
        if (!colSequence) missing.push('Séquence')

        if (missing.length > 0) {
          reject(new Error(
            `Colonnes manquantes : ${missing.join(', ')}. ` +
            `Le fichier doit être un décompte chronologique avec les colonnes : Jour, Début, Fin, Séquence. ` +
            `Colonnes trouvées : ${headers.join(', ')}`
          ))
          return
        }

        // Parser les activités
        const activities: Activity[] = []
        let currentDate: { year: number; month: number; day: number } | null = null
        let skippedRows = 0

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]

          // Parser le jour (peut être vide = même jour que le précédent)
          const jourVal = row[colJour!]
          if (jourVal && String(jourVal).trim()) {
            const parsed = parseFrenchJour(String(jourVal))
            if (parsed) {
              currentDate = parsed
            }
          }

          if (!currentDate) {
            skippedRows++
            continue
          }

          // Parser début et fin
          const debutStr = String(row[colDebut!] || '').trim()
          const finStr = String(row[colFin!] || '').trim()
          const seqStr = String(row[colSequence!] || '').trim().toLowerCase()

          const debut = parseTime(debutStr)
          const fin = parseTime(finStr)

          if (!debut || !fin || !seqStr) {
            skippedRows++
            continue
          }

          // Mapper la séquence
          const actType = SEQUENCE_MAP[seqStr] || 'UNKNOWN'

          // Construire les timestamps
          const startTs = buildTimestamp(currentDate.year, currentDate.month, currentDate.day, debut.hours, debut.minutes)

          // Détecter le passage minuit : si fin < début, on ajoute 1 jour
          let endDate = currentDate
          if (fin.hours < debut.hours || (fin.hours === debut.hours && fin.minutes < debut.minutes)) {
            endDate = addDays(currentDate, 1)
          }
          const endTs = buildTimestamp(endDate.year, endDate.month, endDate.day, fin.hours, fin.minutes)

          // Calculer la durée
          const startTime = new Date(startTs).getTime()
          const endTime = new Date(endTs).getTime()
          const durationMin = (endTime - startTime) / 60_000

          if (durationMin <= 0) {
            skippedRows++
            continue
          }

          activities.push({
            type: actType,
            start: startTs,
            end: endTs,
            duration_minutes: durationMin,
          })
        }

        if (activities.length === 0) {
          reject(new Error(
            `Aucune activité valide trouvée dans le fichier. ` +
            `${skippedRows} lignes ignorées. Vérifiez le format du fichier.`
          ))
          return
        }

        // Trier par date de début
        activities.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

        // Injecter les repos implicites entre les jours
        // Les fichiers Excel chronologiques ne contiennent que les heures de travail.
        // Les repos de nuit (gaps entre dernier activité du jour et première du lendemain)
        // doivent être ajoutés comme activités REST synthétiques.
        const withRests: Activity[] = []
        for (let i = 0; i < activities.length; i++) {
          withRests.push(activities[i])

          if (i < activities.length - 1) {
            const currentEnd = new Date(activities[i].end).getTime()
            const nextStart = new Date(activities[i + 1].start).getTime()
            const gapMin = (nextStart - currentEnd) / 60_000

            // Si gap > 30 min entre deux activités, injecter un REST
            // (les petits gaps < 30 min sont des transitions normales)
            if (gapMin > 30) {
              withRests.push({
                type: 'REST',
                start: activities[i].end,
                end: activities[i + 1].start,
                duration_minutes: gapMin,
              })
            }
          }
        }

        // Calculer la période
        const periodStart = withRests[0].start.split('T')[0]
        const periodEnd = withRests[withRests.length - 1].end.split('T')[0]

        resolve({
          activities: withRests,
          periodStart,
          periodEnd,
          fileName: file.name,
          rowCount: withRests.length,
        })
      } catch (error) {
        reject(new Error(`Erreur lors du parsing : ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Erreur lors de la lecture du fichier'))
    }

    reader.readAsBinaryString(file)
  })
}

/**
 * Valide le format d'un fichier avant de l'analyser
 */
export function validateFileFormat(file: File): { valid: boolean; error?: string } {
  const validExtensions = ['.xlsx', '.xls', '.csv']
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

  if (!validExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `Format non supporté. Extensions acceptées : ${validExtensions.join(', ')}`,
    }
  }

  const maxSize = 30 * 1024 * 1024
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille maximale : 30 MB`,
    }
  }

  return { valid: true }
}
