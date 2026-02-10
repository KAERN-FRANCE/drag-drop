/**
 * Transformation des activités C1B en format LigneRaw
 *
 * Convertit les activités brutes du parser C1B (Python)
 * en lignes journalières/hebdomadaires compatibles avec
 * l'algorithme d'analyse d'infractions TypeScript.
 */

import { LigneRaw } from '@/types'

// ==========================================
// TYPES C1B (réponse de l'API Python)
// ==========================================

export interface C1BActivity {
  type: 'DRIVING' | 'WORK' | 'REST' | 'AVAILABILITY' | 'UNKNOWN'
  start: string   // ISO 8601 (ex: "2024-09-30T08:00:00+00:00")
  end: string     // ISO 8601
  duration_minutes: number
  vehicle_registration?: string | null
}

export interface C1BDriverResult {
  driver_name: string
  card_number: string
  activities: C1BActivity[]
}

export interface C1BParseResponse {
  filename: string
  file_type: string
  drivers_found: number
  results: C1BDriverResult[]
}

// ==========================================
// UTILITAIRES
// ==========================================

const JOURS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const

const MOIS_FR = [
  'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc',
] as const

/**
 * Formate des minutes en "HH:MM"
 */
function formatMinutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Formate une Date en "Lun. 30 Sept. 2024"
 */
function formatDateFr(date: Date): string {
  const jour = JOURS_FR[date.getDay()]
  const numero = date.getDate()
  const mois = MOIS_FR[date.getMonth()]
  const annee = date.getFullYear()
  return `${jour}. ${numero} ${mois}. ${annee}`
}

/**
 * Extrait la date locale (YYYY-MM-DD) d'un timestamp ISO
 * Utilise le fuseau Europe/Paris pour regrouper par jour
 */
function extractLocalDate(isoString: string): string {
  const date = new Date(isoString)
  // Formatter en fuseau français (UTC+1/+2)
  const parts = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).formatToParts(date)

  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

/**
 * Crée un objet Date à partir d'une clé "YYYY-MM-DD"
 */
function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Calcule le numéro de semaine ISO (lundi = jour 1)
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7 // dimanche = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Retourne l'année ISO de la semaine (peut différer de l'année calendaire)
 */
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

// ==========================================
// TRANSFORMATION PRINCIPALE
// ==========================================

interface DayData {
  dateKey: string
  drivingMinutes: number
  restMinutes: number
  earliestWorkStart: number    // timestamp ms — première activité non-repos
  latestWorkEnd: number        // timestamp ms — dernière activité non-repos
  hasWorkActivity: boolean
}

/**
 * Convertit les activités C1B en format LigneRaw[]
 * compatible avec extraireDonneesAnalyse() et detecterInfractions()
 */
export function convertC1BToLigneRaw(driverResult: C1BDriverResult): LigneRaw[] {
  const activities = driverResult.activities

  if (!activities || activities.length === 0) {
    return []
  }

  // 1. Grouper les activités par jour (date locale France)
  const dayMap = new Map<string, DayData>()

  for (const activity of activities) {
    const dateKey = extractLocalDate(activity.start)
    const startTs = new Date(activity.start).getTime()
    const endTs = new Date(activity.end).getTime()

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        dateKey,
        drivingMinutes: 0,
        restMinutes: 0,
        earliestWorkStart: Infinity,
        latestWorkEnd: 0,
        hasWorkActivity: false,
      })
    }

    const day = dayMap.get(dateKey)!

    if (activity.type === 'DRIVING') {
      day.drivingMinutes += activity.duration_minutes
    } else if (activity.type === 'REST') {
      day.restMinutes += activity.duration_minutes
    }

    // L'amplitude = première activité non-repos → dernière activité non-repos
    if (activity.type !== 'REST') {
      day.hasWorkActivity = true
      if (startTs < day.earliestWorkStart) day.earliestWorkStart = startTs
      if (endTs > day.latestWorkEnd) day.latestWorkEnd = endTs
    }
  }

  // 2. Trier les jours chronologiquement
  const sortedDays = Array.from(dayMap.values()).sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey)
  )

  // 3. Générer les lignes journalières
  const dailyRows: LigneRaw[] = sortedDays.map(day => {
    const date = dateFromKey(day.dateKey)
    // Amplitude = première activité non-repos → dernière activité non-repos
    const amplitudeMinutes = day.hasWorkActivity
      ? Math.round((day.latestWorkEnd - day.earliestWorkStart) / 60000)
      : 0

    return {
      Date: formatDateFr(date),
      Conduite: formatMinutesToHHMM(day.drivingMinutes),
      'R.Journ': formatMinutesToHHMM(day.restMinutes),
      Amplitude: formatMinutesToHHMM(amplitudeMinutes),
      Distance: 0,
      'R. Hebdo': '',
    }
  })

  // 4. Grouper par semaine ISO pour générer les lignes hebdomadaires
  const weekMap = new Map<string, {
    weekLabel: string
    totalDrivingMinutes: number
    totalRestMinutes: number
    dailyRows: LigneRaw[]
  }>()

  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i]
    const date = dateFromKey(day.dateKey)
    const weekNum = getISOWeekNumber(date)
    const weekYear = getISOWeekYear(date)
    const weekKey = `${weekYear}-W${weekNum}`
    const weekLabel = `Semaine ${weekNum} ${weekYear}`

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekLabel,
        totalDrivingMinutes: 0,
        totalRestMinutes: 0,
        dailyRows: [],
      })
    }

    const week = weekMap.get(weekKey)!
    week.totalDrivingMinutes += day.drivingMinutes
    week.totalRestMinutes += day.restMinutes
    week.dailyRows.push(dailyRows[i])
  }

  // 5. Assembler : jours de chaque semaine + ligne hebdomadaire
  const result: LigneRaw[] = []
  const sortedWeeks = Array.from(weekMap.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  )

  for (const [, week] of sortedWeeks) {
    // Ajouter les lignes journalières de cette semaine
    result.push(...week.dailyRows)

    // Ajouter la ligne récapitulative hebdomadaire
    result.push({
      Date: week.weekLabel,
      Conduite: formatMinutesToHHMM(week.totalDrivingMinutes),
      'R.Journ': '',
      Amplitude: '',
      Distance: 0,
      'R. Hebdo': formatMinutesToHHMM(week.totalRestMinutes),
    })
  }

  return result
}

/**
 * Détecte si un fichier est de type C1B/DDD/V1B
 */
export function isC1BFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  return ['.c1b', '.ddd', '.v1b'].includes(ext)
}
