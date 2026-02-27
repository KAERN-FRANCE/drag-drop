/**
 * Détection d'infractions depuis les activités C1B brutes (timestamps précis)
 *
 * Conformité : Règlement CE 561/2006
 *
 * Corrections v2 :
 * - Les activités qui chevauchent minuit sont découpées entre les deux jours
 *   (évite les fausses infractions d'amplitude dues au cross-midnight)
 * - Détection PAUSE 4h30 avec prise en charge de la pause fractionnée (15+30 min)
 */

import type { C1BActivity } from './c1b-transformer'
import type { Infraction, GraviteInfraction } from '@/types'
import { REGLES_INFRACTIONS } from '@/types'

// Tolérance : 1 minute en heures
const EPSILON = 1 / 60

// ── Utilitaires timezone ─────────────────────────────

/**
 * Extrait la date locale (YYYY-MM-DD) d'un timestamp ISO en timezone Europe/Paris
 */
function extractLocalDate(isoString: string): string {
  const date = new Date(isoString)
  const parts = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Europe/Paris',
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

/**
 * Retourne le timestamp UTC correspondant à minuit Europe/Paris pour dateKey (YYYY-MM-DD).
 * Gère le changement d'heure été/hiver automatiquement.
 */
function getParisStartOfDayTs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  // Minuit UTC de ce jour calendaire
  const midnightUTC = Date.UTC(y, m - 1, d)
  // Heure affichée à Paris à ce moment (= décalage Paris/UTC, toujours 1 ou 2)
  const parisHour = parseInt(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', hour: 'numeric', hour12: false,
    }).format(new Date(midnightUTC))
  )
  // Minuit Paris = minuit UTC - décalage
  return midnightUTC - parisHour * 3_600_000
}

/**
 * Retourne le dateKey du jour suivant (arithmétique UTC, sans ambiguïté DST).
 */
function getNextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const y2 = next.getUTCFullYear()
  const m2 = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d2 = String(next.getUTCDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

// ── Utilitaires affichage ────────────────────────────

function formatDateFr(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
  return `${JOURS[date.getDay()]}. ${date.getDate()} ${MOIS[date.getMonth()]}. ${y}`
}

function getISOWeekNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function getISOWeekYear(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  return date.getUTCFullYear()
}

// ── Structures internes ───────────────────────────────

interface DayData {
  drivingMinutes: number
  restMinutes: number
  firstWorkTs: number   // timestamp UTC du début de la 1ère activité non-repos
  lastWorkTs: number    // timestamp UTC de la fin de la dernière activité non-repos
  hasWork: boolean
}

interface DayStats {
  dateKey: string
  dateLabel: string
  drivingMinutes: number
  restMinutes: number
  amplitudeMinutes: number
}

interface WeekStats {
  weekKey: string
  weekLabel: string
  drivingMinutes: number
  restMinutes: number
  days: DayStats[]
}

// ── Analyse principale ────────────────────────────────

export function detecterInfractionsC1BRaw(activities: C1BActivity[]): Infraction[] {
  if (!activities || activities.length === 0) return []

  const sorted = [...activities].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )

  // ══════════════════════════════════════════════════
  // 1. Agréger par jour calendaire en découpant les
  //    activités qui chevauchent minuit Europe/Paris
  // ══════════════════════════════════════════════════
  const dayMap = new Map<string, DayData>()

  for (const act of sorted) {
    const actStartTs = new Date(act.start).getTime()
    const actEndTs   = new Date(act.end).getTime()

    let currentDateKey = extractLocalDate(act.start)

    // Parcourir tous les jours que cette activité touche (max 7 par sécurité)
    for (let guard = 0; guard < 7; guard++) {
      const dayStartTs  = getParisStartOfDayTs(currentDateKey)
      const nextDateKey = getNextDateKey(currentDateKey)
      const dayEndTs    = getParisStartOfDayTs(nextDateKey)

      const clipStart = Math.max(actStartTs, dayStartTs)
      const clipEnd   = Math.min(actEndTs,   dayEndTs)

      if (clipStart >= clipEnd) break

      const clipMinutes = (clipEnd - clipStart) / 60_000

      if (!dayMap.has(currentDateKey)) {
        dayMap.set(currentDateKey, {
          drivingMinutes: 0, restMinutes: 0,
          firstWorkTs: Infinity, lastWorkTs: 0, hasWork: false,
        })
      }
      const day = dayMap.get(currentDateKey)!

      if (act.type === 'DRIVING') {
        day.drivingMinutes += clipMinutes
      } else if (act.type === 'REST') {
        day.restMinutes += clipMinutes
      }

      if (act.type !== 'REST') {
        day.hasWork = true
        if (clipStart < day.firstWorkTs) day.firstWorkTs = clipStart
        if (clipEnd   > day.lastWorkTs)  day.lastWorkTs  = clipEnd
      }

      if (actEndTs <= dayEndTs) break
      currentDateKey = nextDateKey
    }
  }

  // Construire DayStats[]
  const dayStats: DayStats[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, d]) => ({
      dateKey,
      dateLabel: formatDateFr(dateKey),
      drivingMinutes: Math.round(d.drivingMinutes),
      restMinutes:    Math.round(d.restMinutes),
      amplitudeMinutes: d.hasWork
        ? Math.round((d.lastWorkTs - d.firstWorkTs) / 60_000)
        : 0,
    }))

  // Agréger par semaine ISO
  const weekMap = new Map<string, WeekStats>()
  for (const day of dayStats) {
    const wn = getISOWeekNumber(day.dateKey)
    const wy = getISOWeekYear(day.dateKey)
    const wk = `${wy}-W${String(wn).padStart(2, '0')}`
    if (!weekMap.has(wk)) {
      weekMap.set(wk, { weekKey: wk, weekLabel: `Semaine ${wn} ${wy}`, drivingMinutes: 0, restMinutes: 0, days: [] })
    }
    const week = weekMap.get(wk)!
    week.drivingMinutes += day.drivingMinutes
    week.restMinutes    += day.restMinutes
    week.days.push(day)
  }
  const weekStats = Array.from(weekMap.values()).sort((a, b) => a.weekKey.localeCompare(b.weekKey))

  const infractions: Infraction[] = []

  // ══════════════════════════════════════════════════
  // 2. Infractions journalières (groupées par semaine pour les exceptions)
  // ══════════════════════════════════════════════════
  for (const week of weekStats) {

    // ── Conduite > 10h (absolue) ──
    for (const jour of week.days) {
      const h = jour.drivingMinutes / 60
      if (h > 10 + EPSILON) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_JOUR_9H')!
        const dep = h - 10
        const grav: GraviteInfraction = dep > 1 ? '5eme' : '4eme'
        infractions.push({
          date: jour.dateLabel, type: 'Conduite journalière excessive', code: regle.code,
          detail: `${h.toFixed(2)}h de conduite (max 10h absolu, +${dep.toFixed(2)}h)`,
          valeur_constatee: h, limite_reglementaire: 10, gravite: grav,
          amende_min: grav === '5eme' ? 1500 : 135, amende_max: grav === '5eme' ? 3000 : 750,
          article_loi: regle.article_loi,
        })
      }
    }

    // ── Conduite 9h-10h : max 2 fois/semaine ──
    const jours9h10h = week.days.filter(
      d => d.drivingMinutes > (9 + EPSILON) * 60 && d.drivingMinutes <= (10 + EPSILON) * 60
    )
    if (jours9h10h.length > 2) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_JOUR_10H_FREQ')!
      const tries = [...jours9h10h].sort((a, b) => b.drivingMinutes - a.drivingMinutes)
      for (let i = 2; i < tries.length; i++) {
        const jour = tries[i]
        const h = jour.drivingMinutes / 60
        infractions.push({
          date: jour.dateLabel, type: 'Dépassement fréquence 10h', code: regle.code,
          detail: `${h.toFixed(2)}h (>9h autorisé 2 fois/semaine max, ceci est le ${i + 1}ème)`,
          valeur_constatee: h, limite_reglementaire: 9, gravite: '4eme',
          amende_min: 135, amende_max: 750, article_loi: regle.article_loi,
        })
      }
    }

    // ── Repos < 9h (absolu) ──
    for (const jour of week.days) {
      if (jour.restMinutes === 0) continue
      if (jour.restMinutes < 9 * 60) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_JOUR_11H')!
        const h = jour.restMinutes / 60
        const grav: GraviteInfraction = h < 6 ? '5eme' : '4eme'
        infractions.push({
          date: jour.dateLabel, type: 'Repos journalier insuffisant', code: regle.code,
          detail: `${h.toFixed(2)}h de repos (min 9h absolu)`,
          valeur_constatee: h, limite_reglementaire: 9, gravite: grav,
          amende_min: grav === '5eme' ? 1500 : 135, amende_max: grav === '5eme' ? 3000 : 750,
          article_loi: regle.article_loi,
        })
      }
    }

    // ── Repos 9h-11h : max 3 fois/semaine ──
    const joursReposReduit = week.days.filter(d => d.restMinutes >= 9 * 60 && d.restMinutes < 11 * 60)
    if (joursReposReduit.length > 3) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_JOUR_11H')!
      const tries = [...joursReposReduit].sort((a, b) => a.restMinutes - b.restMinutes)
      for (let i = 3; i < tries.length; i++) {
        const jour = tries[i]
        const h = jour.restMinutes / 60
        infractions.push({
          date: jour.dateLabel, type: 'Repos journalier réduit excessif', code: regle.code,
          detail: `${h.toFixed(2)}h (repos réduit 9-11h autorisé 3 fois/semaine max, ceci est le ${i + 1}ème)`,
          valeur_constatee: h, limite_reglementaire: 11, gravite: '4eme',
          amende_min: 135, amende_max: 750, article_loi: regle.article_loi,
        })
      }
    }

    // ── Amplitude ──
    for (const jour of week.days) {
      const amp = jour.amplitudeMinutes / 60
      if (amp > 14 + EPSILON) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'AMPLITUDE_12H')!
        infractions.push({
          date: jour.dateLabel, type: 'Amplitude journalière excessive', code: regle.code,
          detail: `${amp.toFixed(2)}h d'amplitude (max 14h absolu)`,
          valeur_constatee: amp, limite_reglementaire: 14, gravite: '4eme',
          amende_min: 135, amende_max: 750, article_loi: regle.article_loi,
        })
      } else if (amp > 12 + EPSILON) {
        const conduiteOk = jour.drivingMinutes <= (10 + EPSILON) * 60
        const reposOk    = jour.restMinutes === 0 || jour.restMinutes >= 9 * 60
        if (!conduiteOk || !reposOk) {
          const regle = REGLES_INFRACTIONS.find(r => r.code === 'AMPLITUDE_12H')!
          const raisons: string[] = []
          if (!conduiteOk) raisons.push('conduite >10h')
          if (!reposOk)    raisons.push('repos <9h')
          infractions.push({
            date: jour.dateLabel, type: 'Amplitude journalière excessive', code: regle.code,
            detail: `${amp.toFixed(2)}h d'amplitude (12h max, ext. 14h refusée : ${raisons.join(' et ')})`,
            valeur_constatee: amp, limite_reglementaire: 12, gravite: '4eme',
            amende_min: 135, amende_max: 750, article_loi: regle.article_loi,
          })
        }
      }
    }
  }

  // ══════════════════════════════════════════════════
  // 3. Infractions hebdomadaires
  // ══════════════════════════════════════════════════
  for (const week of weekStats) {
    const conduiteH = week.drivingMinutes / 60
    if (conduiteH > 56 + EPSILON) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_HEBDO_56H')!
      const dep = conduiteH - 56
      const grav: GraviteInfraction = dep > 14 ? '5eme' : '4eme'
      infractions.push({
        date: week.weekLabel, type: 'Conduite hebdomadaire excessive', code: regle.code,
        detail: `${conduiteH.toFixed(2)}h (max 56h, +${dep.toFixed(2)}h)`,
        valeur_constatee: conduiteH, limite_reglementaire: 56, gravite: grav,
        amende_min: grav === '5eme' ? 1500 : 135, amende_max: grav === '5eme' ? 3000 : 750,
        article_loi: regle.article_loi,
      })
    }

    const reposH = week.restMinutes / 60
    if (reposH > 0 && reposH < 45) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_HEBDO_45H')!
      const grav: GraviteInfraction = reposH < 20 ? '5eme' : '4eme'
      infractions.push({
        date: week.weekLabel, type: 'Repos hebdomadaire insuffisant', code: regle.code,
        detail: `${reposH.toFixed(2)}h de repos (min 45h, réduction 24h avec compensation)`,
        valeur_constatee: reposH, limite_reglementaire: 45, gravite: grav,
        amende_min: grav === '5eme' ? 1500 : 135, amende_max: grav === '5eme' ? 3000 : 750,
        article_loi: regle.article_loi,
      })
    }
  }

  // ══════════════════════════════════════════════════
  // 4. Infractions bi-hebdomadaires (90h)
  // ══════════════════════════════════════════════════
  for (let i = 0; i < weekStats.length - 1; i++) {
    const w1 = weekStats[i], w2 = weekStats[i + 1]
    const total = (w1.drivingMinutes + w2.drivingMinutes) / 60
    if (total > 90) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_2SEM_90H')!
      const dep  = total - 90
      const grav: GraviteInfraction = dep > 22.5 ? '5eme' : '4eme'
      infractions.push({
        date: `${w1.weekLabel} + ${w2.weekLabel}`, type: 'Conduite 2 semaines excessive', code: regle.code,
        detail: `${total.toFixed(2)}h sur 2 semaines (max 90h, +${dep.toFixed(2)}h)`,
        valeur_constatee: total, limite_reglementaire: 90, gravite: grav,
        amende_min: grav === '5eme' ? 1500 : 135, amende_max: grav === '5eme' ? 3000 : 750,
        article_loi: regle.article_loi,
      })
    }
  }

  // ══════════════════════════════════════════════════
  // 5. Pause 4h30 — Art. 7 CE 561/2006
  //    Pause fractionnée : 1ère partie ≥ 15 min + 2ème partie ≥ 30 min
  //    (conduite possible entre les deux parties)
  // ══════════════════════════════════════════════════
  const PAUSE_LIMIT  = 270  // 4h30 en minutes
  const BREAK1_MIN   = 15
  const BREAK2_MIN   = 30
  const BREAK_FULL   = 45

  let conducteSinceBreak = 0
  let breakPhase    = 0   // 0 = aucune, 1 = 1ère partie prise
  let firstBreakMin = 0
  let segmentStart: string | null = null

  for (const act of sorted) {
    if (act.type === 'DRIVING') {
      if (conducteSinceBreak === 0) segmentStart = act.start
      conducteSinceBreak += act.duration_minutes

      if (conducteSinceBreak > PAUSE_LIMIT) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'PAUSE_4H30')!
        const dateLabel = segmentStart
          ? formatDateFr(extractLocalDate(segmentStart))
          : formatDateFr(extractLocalDate(act.start))
        infractions.push({
          date: dateLabel, type: 'Pause 4h30 manquante', code: regle.code,
          detail: `${(conducteSinceBreak / 60).toFixed(2)}h de conduite sans pause réglementaire`,
          valeur_constatee: conducteSinceBreak / 60, limite_reglementaire: 4.5, gravite: '4eme',
          amende_min: 135, amende_max: 750, article_loi: regle.article_loi,
        })
        conducteSinceBreak = 0
        breakPhase = 0
        firstBreakMin = 0
        segmentStart = act.start
      }

    } else if ((act.type === 'REST' || act.type === 'AVAILABILITY') && conducteSinceBreak > 0) {
      const dur = act.duration_minutes

      if (breakPhase === 0) {
        if (dur >= BREAK_FULL) {
          // Pause unique complète
          conducteSinceBreak = 0; breakPhase = 0; firstBreakMin = 0; segmentStart = null
        } else if (dur >= BREAK1_MIN) {
          // 1ère partie d'une pause fractionnée
          breakPhase = 1; firstBreakMin = dur
        }
      } else {
        // On attend la 2ème partie
        if (dur >= BREAK2_MIN || (firstBreakMin + dur) >= BREAK_FULL) {
          // 2ème partie valide
          conducteSinceBreak = 0; breakPhase = 0; firstBreakMin = 0; segmentStart = null
        }
        // Sinon : pause insuffisante, continue d'attendre
      }
    }
  }

  return infractions
}
