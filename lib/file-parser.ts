/**
 * Parser pour fichiers Excel chronologiques (décompte chronologique)
 *
 * Formats supportés :
 * 1. Standard : Jour | Début | Fin | Durée | Séquence
 * 2. Résumé journalier : Jour | Début | Fin | Cond | Trav | Coup
 * 3. Date éclatée : Jour(sem) | JourNum | Mois | Année | Début | Fin | Durée | Séquence
 *    (format où la date est répartie sur 4 colonnes avec headers décalés)
 */

import * as XLSX from 'xlsx';
import { Activity } from '@/types';

export interface DriverBlock {
  index: number
  vehicles: string  // ex: "GM-523-RV, GM-230-CW"
  dayCount: number
}

export interface ParsedChronoData {
  activities: Activity[]
  periodStart: string  // YYYY-MM-DD
  periodEnd: string    // YYYY-MM-DD
  fileName: string
  rowCount: number
  isDailySummary: boolean
  driverBlocks: DriverBlock[]
  allBlockActivities?: Activity[][] // toutes les activités par bloc conducteur
}

// Mapping mois français abrégés → numéro (0-indexed)
const MOIS_MAP: Record<string, number> = {
  'jan': 0, 'fev': 1, 'fév': 1, 'feb': 1,
  'mar': 2, 'avr': 3, 'apr': 3,
  'mai': 4, 'may': 4, 'jun': 5, 'jui': 5,
  'jul': 6, 'juil': 6, 'aou': 7, 'aoû': 7, 'aug': 7,
  'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11, 'déc': 11,
}

// Jours de la semaine français (pour détecter le format date éclatée)
const JOURS_SEMAINE = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

// Mapping séquence → Activity type (toutes variantes logiciels tachygraphes)
const SEQUENCE_MAP: Record<string, Activity['type']> = {
  // DRIVING
  'conduite': 'DRIVING', 'cond': 'DRIVING', 'cond.': 'DRIVING', 'cond,': 'DRIVING', 'c': 'DRIVING',
  // WORK
  'travail': 'WORK', 'trav': 'WORK', 'trav.': 'WORK', 'trav,': 'WORK', 't': 'WORK',
  // REST
  'repos': 'REST', 'coupure': 'REST', 'coup': 'REST', 'coup.': 'REST', 'coup,': 'REST',
  'pause': 'REST', 'r': 'REST',
  // AVAILABILITY
  'dispo': 'AVAILABILITY', 'disponibilite': 'AVAILABILITY', 'disponibilité': 'AVAILABILITY',
  'disposition': 'AVAILABILITY', 'disp': 'AVAILABILITY', 'disp.': 'AVAILABILITY', 'disp,': 'AVAILABILITY',
  'd': 'AVAILABILITY',
  // CODES NUMÉRIQUES C1B (Tachogest, Architac — standard EU 2 bits)
  '0': 'REST', '1': 'AVAILABILITY', '2': 'WORK', '3': 'DRIVING',
  // UNKNOWN
  'autre': 'UNKNOWN', 'a': 'UNKNOWN', 'inconnu': 'UNKNOWN',
}

/**
 * Normalise un nom de colonne :
 * - Retire les accents
 * - Remplace \ et newlines par un espace (headers multi-lignes Tachogest)
 * - Supprime la ponctuation finale (. ,)
 * - Lowercase + trim + collapse espaces
 */
function normalizeColName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\\n\r]/g, ' ')
    .replace(/[.,]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Trouve une colonne par nom normalisé parmi les colonnes disponibles.
 * `exclude` : si le header normalisé contient un de ces termes, il est ignoré
 * (ex: exclure "ampl" pour que "Début\Ampl." ne matche pas "Début")
 */
function findColumn(headers: string[], candidates: string[], exclude: string[] = []): string | null {
  const nc = candidates.map(normalizeColName)
  const ne = exclude.map(normalizeColName)
  for (const header of headers) {
    const nh = normalizeColName(header)
    if (ne.some(ex => nh.includes(ex))) continue
    if (nc.includes(nh)) return header
  }
  return null
}

/**
 * Détecte le format "date éclatée" où la date est sur 4 colonnes :
 * Jour(semaine) | JourNum | Mois | Année | HeureDébut | HeureFin | Durée | Séquence
 * Mais les headers sont décalés : Jour | Début | Fin | Durée | Séquence | Cond, | Trav, | Disp,
 *
 * Signature : colonne "Jour" contient un jour de semaine (Lun, Mar...) et
 *             colonne "Début" contient un nombre 1-31 (le numéro du jour)
 */
function detectSplitDateFormat(rows: Record<string, any>[], headers: string[]): {
  isSplitDate: boolean
  colJourSemaine?: string | null
  colJourNum?: string | null
  colMois?: string | null
  colAnnee?: string | null
  colDebut?: string | null
  colFin?: string | null
  colSequence?: string | null
  colNom?: string | null
} {
  const colJour = findColumn(headers, ['Jour', 'Date'])
  const colDebut = findColumn(headers, ['Début', 'Debut'], ['ampl'])
  const colFin = findColumn(headers, ['Fin'], ['ampl'])
  const colDuree = findColumn(headers, ['Durée', 'Duree'])
  const colSequence = findColumn(headers, ['Séquence', 'Sequence'])
  const colCond = findColumn(headers, ['Cond,', 'Cond'])
  const colDisp = findColumn(headers, ['Disp,', 'Disp'])
  const colNom = findColumn(headers, ['Nom', 'Conducteur', 'Chauffeur', 'Driver'])

  if (!colJour || !colDebut || !colFin || !colDuree) {
    return { isSplitDate: false }
  }

  // Vérifier sur les premières lignes de données
  let matchCount = 0
  const sample = rows.slice(0, 10)

  for (const row of sample) {
    const jourVal = String(row[colJour] || '').toLowerCase().replace(/[.,]/g, '').trim()
    const debutVal = row[colDebut]
    const finVal = String(row[colFin] || '').toLowerCase().replace(/[.,]/g, '').trim()
    const dureeVal = row[colDuree]

    const isJourSemaine = JOURS_SEMAINE.some(j => jourVal.startsWith(j))
    const isDebutJourNum = typeof debutVal === 'number' && debutVal >= 1 && debutVal <= 31
    const isMoisFr = Object.keys(MOIS_MAP).some(m => finVal.startsWith(m))
    const isAnnee = typeof dureeVal === 'number' && dureeVal >= 2020 && dureeVal <= 2035

    if (isJourSemaine && isDebutJourNum && isMoisFr && isAnnee) {
      matchCount++
    }
  }

  if (matchCount >= sample.length * 0.5) {
    return {
      isSplitDate: true,
      colJourSemaine: colJour,
      colJourNum: colDebut,
      colMois: colFin,
      colAnnee: colDuree,
      colDebut: colSequence,
      colFin: colCond,
      colSequence: colDisp,
      colNom: colNom,
    }
  }

  return { isSplitDate: false }
}

/**
 * Parse une date française "Lun. 02 Mar. 2026" → { year, month, day }
 */
function parseFrenchJour(jourStr: string): { year: number; month: number; day: number } | null {
  if (!jourStr || typeof jourStr !== 'string') return null
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
 * Parse une date multi-format : Date JS, nombre Excel, ISO, FR numérique, FR texte
 */
function parseJour(val: any): { year: number; month: number; day: number } | null {
  if (val == null) return null

  // Date JS
  if (val instanceof Date && !isNaN(val.getTime())) {
    return { year: val.getFullYear(), month: val.getMonth(), day: val.getDate() }
  }
  // Nombre YYYYMMDD (ex: 20260302)
  if (typeof val === 'number' && val >= 19000101 && val <= 21001231) {
    const y = Math.floor(val / 10000)
    const m = Math.floor((val % 10000) / 100)
    const d = val % 100
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { year: y, month: m - 1, day: d }
  }
  // Nombre Excel (serial date)
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return { year: d.y, month: d.m - 1, day: d.d }
  }

  const str = String(val).trim()
  if (!str) return null

  // ISO: 2026-03-02
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return { year: +iso[1], month: +iso[2] - 1, day: +iso[3] }

  // FR numérique: 02/03/2026 ou 02.03.2026
  const frNum = str.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (frNum) return { year: +frNum[3], month: +frNum[2] - 1, day: +frNum[1] }

  // FR texte: "Lun. 02 Mar. 2026"
  return parseFrenchJour(str)
}

/**
 * Parse un temps multi-format : nombre Excel, HH:MM, HH:MM:SS
 */
function parseTime(val: any): { hours: number; minutes: number } | null {
  if (val == null) return null

  // Nombre Excel (fraction de jour: 0.5 = 12:00)
  if (typeof val === 'number') {
    const totalMin = Math.round(val * 24 * 60)
    return { hours: Math.floor(totalMin / 60) % 24, minutes: totalMin % 60 }
  }

  const str = String(val).trim()
  // HH:MM ou HH:MM:SS
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
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
 * Injecte des activités REST dans les gaps > 30 min entre activités
 */
function injectRestActivities(activities: Activity[]): Activity[] {
  if (activities.length === 0) return activities

  const sorted = [...activities].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const result: Activity[] = []

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i])

    if (i < sorted.length - 1) {
      const currentEnd = new Date(sorted[i].end).getTime()
      const nextStart = new Date(sorted[i + 1].start).getTime()
      const gapMin = (nextStart - currentEnd) / 60_000

      if (gapMin > 30) {
        result.push({
          type: 'REST',
          start: sorted[i].end,
          end: sorted[i + 1].start,
          duration_minutes: gapMin,
        })
      }
    }
  }

  return result
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

        // Détecter les colonnes (toutes variantes logiciels tachygraphes)
        const headers = Object.keys(rows[0])

        // ══════════════════════════════════════════════════════
        // DÉTECTION FORMAT "DATE ÉCLATÉE" (prioritaire)
        // Format où la date est sur 4 colonnes avec headers décalés
        // ══════════════════════════════════════════════════════
        const splitDateInfo = detectSplitDateFormat(rows, headers)

        if (splitDateInfo.isSplitDate) {
          const activities: Activity[] = []
          let currentDate: { year: number; month: number; day: number } | null = null
          const driverBlocks: DriverBlock[] = []
          const allBlockActivities: Activity[][] = []
          const activitiesByDriver: Map<string, Activity[]> = new Map()

          for (const row of rows) {
            const jourNum = row[splitDateInfo.colJourNum!]
            const moisRaw = String(row[splitDateInfo.colMois!] || '').toLowerCase().replace(/[.,]/g, '').trim()
            const annee = row[splitDateInfo.colAnnee!]

            if (typeof jourNum === 'number' && typeof annee === 'number') {
              const moisKey = moisRaw.substring(0, 3)
              const mois = MOIS_MAP[moisKey]
              if (mois !== undefined) {
                currentDate = { year: annee, month: mois, day: jourNum }
              }
            }

            if (!currentDate) continue

            const debutVal = row[splitDateInfo.colDebut!]
            const finVal = row[splitDateInfo.colFin!]
            const seqVal = String(row[splitDateInfo.colSequence!] || '').trim().toLowerCase()

            const debut = parseTime(debutVal)
            const fin = parseTime(finVal)

            if (!debut || !fin || !seqVal) continue

            const actType = SEQUENCE_MAP[seqVal] || 'UNKNOWN'
            const startTs = buildTimestamp(currentDate.year, currentDate.month, currentDate.day, debut.hours, debut.minutes)

            let endDate = currentDate
            if (fin.hours < debut.hours || (fin.hours === debut.hours && fin.minutes < debut.minutes)) {
              endDate = addDays(currentDate, 1)
            }
            const endTs = buildTimestamp(endDate.year, endDate.month, endDate.day, fin.hours, fin.minutes)

            const durationMin = (new Date(endTs).getTime() - new Date(startTs).getTime()) / 60_000
            if (durationMin <= 0) continue

            const activity: Activity = { type: actType, start: startTs, end: endTs, duration_minutes: durationMin }
            activities.push(activity)

            if (splitDateInfo.colNom) {
              const driverName = String(row[splitDateInfo.colNom] || 'Inconnu').trim()
              if (!activitiesByDriver.has(driverName)) {
                activitiesByDriver.set(driverName, [])
              }
              activitiesByDriver.get(driverName)!.push(activity)
            }
          }

          if (activities.length === 0) {
            reject(new Error('Aucune activité valide trouvée dans le fichier (format date éclatée détecté).'))
            return
          }

          let idx = 0
          for (const [driverName, acts] of activitiesByDriver.entries()) {
            acts.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
            driverBlocks.push({ index: idx, vehicles: driverName, dayCount: new Set(acts.map(a => a.start.split('T')[0])).size })
            allBlockActivities.push(acts)
            idx++
          }

          activities.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          const withRests = injectRestActivities(activities)
          const allBlockWithRests = allBlockActivities.map(acts => injectRestActivities(acts))

          resolve({
            activities: withRests,
            periodStart: withRests[0].start.split('T')[0],
            periodEnd: withRests[withRests.length - 1].end.split('T')[0],
            fileName: file.name,
            rowCount: withRests.length,
            isDailySummary: false,
            driverBlocks,
            allBlockActivities: allBlockWithRests.length > 1 ? allBlockWithRests : undefined,
          })
          return
        }

        // ══════════════════════════════════════════════════════
        // FORMATS STANDARDS (chronologique ou résumé journalier)
        // ══════════════════════════════════════════════════════
        const colJour = findColumn(headers, [
          'Jour', 'Date', 'Journée', 'Journee', 'Jour Date', 'Date Jour',
        ])
        const colDebut = findColumn(headers, [
          'Début', 'Debut', 'Heure début', 'Heure debut', 'Start',
          'HDEB', 'Heure', 'Tachoheure',
        ], ['ampl'])
        const colFin = findColumn(headers, [
          'Fin', 'Heure fin', 'End',
          'HFIN', 'Heure Fin', 'Tachoheurefin',
        ], ['ampl', 'disque'])
        let colSequence = findColumn(headers, [
          'Séquence', 'Sequence', 'Activité', 'Activite', 'Type',
          'Code Séquence', 'Code Sequence', 'CodeSeq',
        ])

        // Fallback : détecter la colonne séquence par ses valeurs
        if (!colSequence) {
          for (const h of headers) {
            let matches = 0
            const sample = rows.slice(0, 20)
            for (const row of sample) {
              const v = String(row[h] || '').trim().toLowerCase()
              if (v && SEQUENCE_MAP[v]) matches++
            }
            if (matches > sample.length * 0.5) {
              colSequence = h
              break
            }
          }
        }

        // ── Détection du format : chronologique (Séquence) ou résumé journalier (Cond/Trav/Coup) ──
        // Colonnes résumé journalier (format TACHO / Tachogest)
        const colCond = findColumn(headers, [
          'Conduite', 'Cond', 'Cond Journ',
        ])
        const colTrav = findColumn(headers, ['Travail', 'Trav'])
        const colDisp = findColumn(headers, [
          'Dispo', 'Disponibilité', 'Disponibilite', 'Disposition', 'Disp',
        ])
        const colCoup = findColumn(headers, ['Coupure', 'Coup'])
        const colRepos = findColumn(headers, ['Repos Jr /Heb', 'Repos Jr/Heb', 'Repos', 'Repos Journalier', 'RJ'])

        const isDailySummary = !colSequence && colJour && colDebut && colFin && colCond
        const isChronological = !!colSequence && !!colJour && !!colDebut && !!colFin

        if (!isDailySummary && !isChronological) {
          const missing: string[] = []
          if (!colJour) missing.push('Jour')
          if (!colDebut) missing.push('Début')
          if (!colFin) missing.push('Fin')
          if (!colSequence && !colCond) missing.push('Séquence ou Conduite')
          reject(new Error(
            `Colonnes manquantes : ${missing.join(', ')}. ` +
            `Le fichier doit être un décompte chronologique (Jour, Début, Fin, Séquence) ` +
            `ou un résumé journalier (Jour, Début, Fin, Cond, Trav, Coup). ` +
            `Colonnes trouvées : ${headers.map(h => `"${h}" [${normalizeColName(h)}]`).join(', ')}`
          ))
          return
        }

        let activities: Activity[]
        let driverBlocks: DriverBlock[] = []
        let allBlockActivities: Activity[][] = []

        // Colonne véhicule (pour identifier les conducteurs dans le résumé)
        const colVehicle = findColumn(headers, [
          'Véhicule', 'Vehicule', 'Véhicule(s)', 'Vehicule(s)',
          'Véhicule(s) ou Activités', 'Vehicule(s) ou Activites',
        ])

        if (isDailySummary) {
          // ═══════════════════════════════════════════════════
          // FORMAT RÉSUMÉ JOURNALIER (1 ligne = 1 jour)
          // Séparer les conducteurs par restart des dates
          // ═══════════════════════════════════════════════════
          const toMin = (v: any) => {
            if (v == null) return 0
            if (typeof v === 'number') return Math.round(v * 24 * 60)
            const m = String(v).match(/^(\d+):(\d{2})/)
            return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0
          }

          // Phase 1 : extraire les lignes journalières avec leur date
          interface DayRow {
            dateObj: { year: number; month: number; day: number }
            dateKey: string
            debut: { hours: number; minutes: number }
            fin: { hours: number; minutes: number }
            condMin: number; travMin: number; dispMin: number; coupMin: number
            vehicle: string
          }
          const dayRows: DayRow[] = []

          for (const row of rows) {
            const jourVal = row[colJour!]
            if (typeof jourVal === 'string' && /semaine|total|mois|trimestre|quadrimestre/i.test(jourVal)) continue
            const dateObj = parseJour(jourVal)
            if (!dateObj) continue
            const debut = parseTime(row[colDebut!])
            const fin = parseTime(row[colFin!])
            if (!debut || !fin) continue

            const pad = (n: number) => n.toString().padStart(2, '0')
            dayRows.push({
              dateObj,
              dateKey: `${dateObj.year}-${pad(dateObj.month + 1)}-${pad(dateObj.day)}`,
              debut, fin,
              condMin: toMin(row[colCond!]),
              travMin: toMin(colTrav ? row[colTrav] : null),
              dispMin: toMin(colDisp ? row[colDisp] : null),
              coupMin: toMin(colCoup ? row[colCoup] : null),
              vehicle: colVehicle ? String(row[colVehicle] || '').trim() : '',
            })
          }

          // Phase 2 : séparer en blocs conducteurs (restart quand la date recule)
          const blocks: DayRow[][] = []
          let currentBlock: DayRow[] = []

          for (const day of dayRows) {
            if (currentBlock.length > 0) {
              const prevKey = currentBlock[currentBlock.length - 1].dateKey
              if (day.dateKey <= prevKey) {
                // Date recule → nouveau conducteur
                blocks.push(currentBlock)
                currentBlock = []
              }
            }
            currentBlock.push(day)
          }
          if (currentBlock.length > 0) blocks.push(currentBlock)

          // Phase 3 : construire les activités pour chaque bloc
          allBlockActivities = blocks.map(block => {
            const acts: Activity[] = []
            for (const day of block) {
              const dayStartTs = buildTimestamp(day.dateObj.year, day.dateObj.month, day.dateObj.day, day.debut.hours, day.debut.minutes)
              let cursor = new Date(dayStartTs).getTime()
              const segs: { type: Activity['type']; min: number }[] = [
                { type: 'DRIVING', min: day.condMin },
                { type: 'WORK', min: day.travMin },
                { type: 'AVAILABILITY', min: day.dispMin },
                { type: 'REST', min: day.coupMin },
              ]
              for (const seg of segs) {
                if (seg.min <= 0) continue
                const segEnd = cursor + seg.min * 60_000
                acts.push({
                  type: seg.type,
                  start: new Date(cursor).toISOString().replace(/\.\d+Z$/, '').split('.')[0],
                  end: new Date(segEnd).toISOString().replace(/\.\d+Z$/, '').split('.')[0],
                  duration_minutes: seg.min,
                })
                cursor = segEnd
              }
            }
            return acts
          })

          // Phase 4 : construire les métadonnées des blocs
          driverBlocks = blocks.map((block, i) => {
            const vehicles = [...new Set(block.map(d => d.vehicle).filter(Boolean))]
            return { index: i, vehicles: vehicles.join(', ') || `Conducteur ${i + 1}`, dayCount: block.length }
          })

          // Par défaut : premier bloc
          activities = allBlockActivities[0] || []
        } else {
          // ═══════════════════════════════════════════════════
          // FORMAT CHRONOLOGIQUE (1 ligne = 1 activité)
          // ═══════════════════════════════════════════════════
          activities = []
          let currentDate: { year: number; month: number; day: number } | null = null
          let skippedRows = 0

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i]

            const jourVal = row[colJour!]
            if (jourVal != null && String(jourVal).trim()) {
              const parsed = parseJour(jourVal)
              if (parsed) currentDate = parsed
            }

            if (!currentDate) { skippedRows++; continue }

            const debutRaw = row[colDebut!]
            const finRaw = row[colFin!]
            const seqStr = String(row[colSequence!] || '').trim().toLowerCase()

            const debut = parseTime(debutRaw)
            const fin = parseTime(finRaw)

            if (!debut || !fin || !seqStr) { skippedRows++; continue }

            const actType = SEQUENCE_MAP[seqStr] || 'UNKNOWN'
            const startTs = buildTimestamp(currentDate.year, currentDate.month, currentDate.day, debut.hours, debut.minutes)

            let endDate = currentDate
            if (fin.hours < debut.hours || (fin.hours === debut.hours && fin.minutes < debut.minutes)) {
              endDate = addDays(currentDate, 1)
            }
            const endTs = buildTimestamp(endDate.year, endDate.month, endDate.day, fin.hours, fin.minutes)

            const durationMin = (new Date(endTs).getTime() - new Date(startTs).getTime()) / 60_000
            if (durationMin <= 0) { skippedRows++; continue }

            activities.push({ type: actType, start: startTs, end: endTs, duration_minutes: durationMin })
          }
        }

        if (activities.length === 0) {
          reject(new Error(
            `Aucune activité valide trouvée dans le fichier. Vérifiez le format du fichier.`
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

        // Injecter les repos dans chaque bloc conducteur aussi
        const allBlockWithRests = allBlockActivities.map(blockActs => {
          const sorted = [...blockActs].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          const result: Activity[] = []
          for (let i = 0; i < sorted.length; i++) {
            result.push(sorted[i])
            if (i < sorted.length - 1) {
              const curEnd = new Date(sorted[i].end).getTime()
              const nxtStart = new Date(sorted[i + 1].start).getTime()
              const gap = (nxtStart - curEnd) / 60_000
              if (gap > 30) {
                result.push({ type: 'REST', start: sorted[i].end, end: sorted[i + 1].start, duration_minutes: gap })
              }
            }
          }
          return result
        })

        resolve({
          activities: withRests,
          periodStart,
          periodEnd,
          fileName: file.name,
          rowCount: withRests.length,
          isDailySummary: !!isDailySummary,
          driverBlocks,
          allBlockActivities: allBlockWithRests.length > 1 ? allBlockWithRests : undefined,
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
