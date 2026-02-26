/**
 * Détection d'infractions depuis les activités C1B brutes (timestamps précis)
 *
 * Avantage vs analyse-infractions.ts : utilise les timestamps exacts pour
 * détecter la règle des 4h30 de conduite continue (Art. 7 CE 561/2006).
 *
 * Conformité : Règlement CE 561/2006
 */

import type { C1BActivity } from './c1b-transformer'
import type { Infraction, GraviteInfraction } from '@/types'
import { REGLES_INFRACTIONS } from '@/types'

// Tolérance flottante (1 minute)
const EPSILON = 1 / 60

// ── Utilitaires ──────────────────────────────────────

function toMinutes(hours: number): number {
  return hours * 60
}

function extractLocalDate(isoString: string): string {
  const date = new Date(isoString)
  const parts = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

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
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getISOWeekYear(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  return date.getUTCFullYear()
}

// ── Structures internes ───────────────────────────────

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

  // 1. Agréger par jour calendaire
  const dayMap = new Map<string, {
    drivingMinutes: number
    restMinutes: number
    firstWorkTs: number
    lastWorkTs: number
    hasWork: boolean
  }>()

  for (const act of sorted) {
    const dateKey = extractLocalDate(act.start)
    const startTs = new Date(act.start).getTime()
    const endTs = new Date(act.end).getTime()

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { drivingMinutes: 0, restMinutes: 0, firstWorkTs: Infinity, lastWorkTs: 0, hasWork: false })
    }
    const day = dayMap.get(dateKey)!

    if (act.type === 'DRIVING') {
      day.drivingMinutes += act.duration_minutes
    } else if (act.type === 'REST') {
      day.restMinutes += act.duration_minutes
    }

    if (act.type !== 'REST') {
      day.hasWork = true
      if (startTs < day.firstWorkTs) day.firstWorkTs = startTs
      if (endTs > day.lastWorkTs) day.lastWorkTs = endTs
    }
  }

  const dayStats: DayStats[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, d]) => ({
      dateKey,
      dateLabel: formatDateFr(dateKey),
      drivingMinutes: d.drivingMinutes,
      restMinutes: d.restMinutes,
      amplitudeMinutes: d.hasWork
        ? Math.round((d.lastWorkTs - d.firstWorkTs) / 60000)
        : 0,
    }))

  // 2. Agréger par semaine ISO
  const weekMap = new Map<string, WeekStats>()
  for (const day of dayStats) {
    const weekNum = getISOWeekNumber(day.dateKey)
    const weekYear = getISOWeekYear(day.dateKey)
    const weekKey = `${weekYear}-W${String(weekNum).padStart(2, '0')}`
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekKey,
        weekLabel: `Semaine ${weekNum} ${weekYear}`,
        drivingMinutes: 0,
        restMinutes: 0,
        days: [],
      })
    }
    const week = weekMap.get(weekKey)!
    week.drivingMinutes += day.drivingMinutes
    week.restMinutes += day.restMinutes
    week.days.push(day)
  }
  const weekStats: WeekStats[] = Array.from(weekMap.values()).sort((a, b) =>
    a.weekKey.localeCompare(b.weekKey)
  )

  const infractions: Infraction[] = []

  // ── 3. Infractions journalières ───────────────────

  for (const week of weekStats) {
    // Conduite > 10h (absolue, toujours infraction)
    const joursAbove10h = week.days.filter(d => d.drivingMinutes > toMinutes(10) + EPSILON * 60)
    for (const jour of joursAbove10h) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_JOUR_9H')!
      const heures = jour.drivingMinutes / 60
      const depassement = heures - 10
      const gravite: GraviteInfraction = depassement > 1 ? '5eme' : '4eme'
      infractions.push({
        date: jour.dateLabel,
        type: 'Conduite journalière excessive',
        code: regle.code,
        detail: `${heures.toFixed(2)}h de conduite (max 10h absolu, dépassement +${depassement.toFixed(2)}h)`,
        valeur_constatee: heures,
        limite_reglementaire: 10,
        gravite,
        amende_min: gravite === '5eme' ? 1500 : 135,
        amende_max: gravite === '5eme' ? 3000 : 750,
        article_loi: regle.article_loi,
      })
    }

    // Conduite 9h-10h : max 2 fois/semaine
    const jours9h10h = week.days.filter(
      d => d.drivingMinutes > toMinutes(9) + EPSILON * 60 && d.drivingMinutes <= toMinutes(10) + EPSILON * 60
    )
    if (jours9h10h.length > 2) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_JOUR_10H_FREQ')!
      const joursTriés = [...jours9h10h].sort((a, b) => b.drivingMinutes - a.drivingMinutes)
      for (let i = 2; i < joursTriés.length; i++) {
        const jour = joursTriés[i]
        const heures = jour.drivingMinutes / 60
        infractions.push({
          date: jour.dateLabel,
          type: 'Dépassement fréquence 10h',
          code: regle.code,
          detail: `${heures.toFixed(2)}h de conduite (>9h autorisé seulement 2 fois/semaine, ceci est le ${i + 1}ème jour)`,
          valeur_constatee: heures,
          limite_reglementaire: 9,
          gravite: '4eme',
          amende_min: 135,
          amende_max: 750,
          article_loi: regle.article_loi,
        })
      }
    }

    // Repos < 9h (absolu, toujours infraction)
    for (const jour of week.days) {
      if (jour.restMinutes === 0) continue
      if (jour.restMinutes < toMinutes(9)) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_JOUR_11H')!
        const heures = jour.restMinutes / 60
        const gravite: GraviteInfraction = heures < 6 ? '5eme' : '4eme'
        infractions.push({
          date: jour.dateLabel,
          type: 'Repos journalier insuffisant',
          code: regle.code,
          detail: `${heures.toFixed(2)}h de repos (min 9h absolu)`,
          valeur_constatee: heures,
          limite_reglementaire: 9,
          gravite,
          amende_min: gravite === '5eme' ? 1500 : 135,
          amende_max: gravite === '5eme' ? 3000 : 750,
          article_loi: regle.article_loi,
        })
      }
    }

    // Repos 9h-11h : max 3 fois/semaine
    const joursReposReduit = week.days.filter(
      d => d.restMinutes >= toMinutes(9) && d.restMinutes < toMinutes(11)
    )
    if (joursReposReduit.length > 3) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_JOUR_11H')!
      const joursTriés = [...joursReposReduit].sort((a, b) => a.restMinutes - b.restMinutes)
      for (let i = 3; i < joursTriés.length; i++) {
        const jour = joursTriés[i]
        const heures = jour.restMinutes / 60
        infractions.push({
          date: jour.dateLabel,
          type: 'Repos journalier réduit excessif',
          code: regle.code,
          detail: `${heures.toFixed(2)}h de repos (repos réduit 9-11h autorisé seulement 3 fois/semaine, ceci est le ${i + 1}ème jour)`,
          valeur_constatee: heures,
          limite_reglementaire: 11,
          gravite: '4eme',
          amende_min: 135,
          amende_max: 750,
          article_loi: regle.article_loi,
        })
      }
    }

    // Amplitude > 14h (absolue)
    for (const jour of week.days) {
      const ampHeures = jour.amplitudeMinutes / 60
      if (ampHeures > 14 + EPSILON) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'AMPLITUDE_12H')!
        infractions.push({
          date: jour.dateLabel,
          type: 'Amplitude journalière excessive',
          code: regle.code,
          detail: `${ampHeures.toFixed(2)}h d'amplitude (max 14h absolu)`,
          valeur_constatee: ampHeures,
          limite_reglementaire: 14,
          gravite: '4eme',
          amende_min: 135,
          amende_max: 750,
          article_loi: regle.article_loi,
        })
      } else if (ampHeures > 12 + EPSILON) {
        const conduiteOk = jour.drivingMinutes <= toMinutes(10) + EPSILON * 60
        const reposOk = jour.restMinutes === 0 || jour.restMinutes >= toMinutes(9)
        if (!conduiteOk || !reposOk) {
          const regle = REGLES_INFRACTIONS.find(r => r.code === 'AMPLITUDE_12H')!
          const raisons: string[] = []
          if (!conduiteOk) raisons.push('conduite >10h')
          if (!reposOk) raisons.push('repos <9h')
          infractions.push({
            date: jour.dateLabel,
            type: 'Amplitude journalière excessive',
            code: regle.code,
            detail: `${ampHeures.toFixed(2)}h d'amplitude (max 12h, extension 14h non autorisée car ${raisons.join(' et ')})`,
            valeur_constatee: ampHeures,
            limite_reglementaire: 12,
            gravite: '4eme',
            amende_min: 135,
            amende_max: 750,
            article_loi: regle.article_loi,
          })
        }
      }
    }
  }

  // ── 4. Infractions hebdomadaires ──────────────────

  for (const week of weekStats) {
    // Conduite > 56h
    const conduiteHebdoH = week.drivingMinutes / 60
    if (conduiteHebdoH > 56 + EPSILON) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_HEBDO_56H')!
      const depassement = conduiteHebdoH - 56
      const gravite: GraviteInfraction = depassement > 14 ? '5eme' : '4eme'
      infractions.push({
        date: week.weekLabel,
        type: 'Conduite hebdomadaire excessive',
        code: regle.code,
        detail: `${conduiteHebdoH.toFixed(2)}h de conduite sur la semaine (max 56h, dépassement +${depassement.toFixed(2)}h)`,
        valeur_constatee: conduiteHebdoH,
        limite_reglementaire: 56,
        gravite,
        amende_min: gravite === '5eme' ? 1500 : 135,
        amende_max: gravite === '5eme' ? 3000 : 750,
        article_loi: regle.article_loi,
      })
    }

    // Repos hebdomadaire < 45h
    const reposHebdoH = week.restMinutes / 60
    if (reposHebdoH > 0 && reposHebdoH < 45) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_HEBDO_45H')!
      const gravite: GraviteInfraction = reposHebdoH < 20 ? '5eme' : '4eme'
      infractions.push({
        date: week.weekLabel,
        type: 'Repos hebdomadaire insuffisant',
        code: regle.code,
        detail: `${reposHebdoH.toFixed(2)}h de repos hebdomadaire (min 45h ou 24h réduit avec compensation)`,
        valeur_constatee: reposHebdoH,
        limite_reglementaire: 45,
        gravite,
        amende_min: gravite === '5eme' ? 1500 : 135,
        amende_max: gravite === '5eme' ? 3000 : 750,
        article_loi: regle.article_loi,
      })
    }
  }

  // ── 5. Infractions bi-hebdomadaires (90h / 2 semaines) ──

  for (let i = 0; i < weekStats.length - 1; i++) {
    const w1 = weekStats[i]
    const w2 = weekStats[i + 1]
    const total2semH = (w1.drivingMinutes + w2.drivingMinutes) / 60
    if (total2semH > 90) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_2SEM_90H')!
      const depassement = total2semH - 90
      const gravite: GraviteInfraction = depassement > 22.5 ? '5eme' : '4eme'
      infractions.push({
        date: `${w1.weekLabel} + ${w2.weekLabel}`,
        type: 'Conduite 2 semaines excessive',
        code: regle.code,
        detail: `${total2semH.toFixed(2)}h de conduite sur 2 semaines consécutives (max 90h, dépassement +${depassement.toFixed(2)}h)`,
        valeur_constatee: total2semH,
        limite_reglementaire: 90,
        gravite,
        amende_min: gravite === '5eme' ? 1500 : 135,
        amende_max: gravite === '5eme' ? 3000 : 750,
        article_loi: regle.article_loi,
      })
    }
  }

  // ── 6. Pause 4h30 (Art. 7 CE 561/2006) ────────────
  // Utilise les timestamps exacts — seul avantage C1B vs LigneRaw

  const PAUSE_4H30_MIN = 270 // 4h30 en minutes
  const PAUSE_MIN_BLOC = 15  // minimum d'une pause fractionnée (15 min)
  const PAUSE_TOTALE = 45    // pause totale requise (45 min)

  let conduiteAccumulee = 0
  let pauseAccumulee = 0
  let premierePausePrise = false // si vrai : 1ère partie de pause fractionnée OK
  let debutSegment: string | null = null

  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i]

    if (act.type === 'DRIVING') {
      if (conduiteAccumulee === 0) {
        debutSegment = act.start
      }
      // Réinitialiser si on avait fait une pause partielle ≥ 15 min
      // et qu'on reprend la conduite
      if (premierePausePrise) {
        // On est dans une pause fractionnée : 1ère partie OK, 2ème partie attendue
        // La reprise de conduite invalide la pause fractionnée si < 45 min total
        if (pauseAccumulee < PAUSE_TOTALE) {
          pauseAccumulee = 0
          premierePausePrise = false
        }
      }

      conduiteAccumulee += act.duration_minutes

      if (conduiteAccumulee > PAUSE_4H30_MIN) {
        // Infraction : 4h30 dépassé sans pause valide
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'PAUSE_4H30')!
        const dateLabel = debutSegment ? formatDateFr(extractLocalDate(debutSegment)) : act.start.split('T')[0]
        infractions.push({
          date: dateLabel,
          type: 'Pause 4h30 manquante',
          code: regle.code,
          detail: `${(conduiteAccumulee / 60).toFixed(2)}h de conduite continue sans pause de 45 min (Art. 7 CE 561/2006)`,
          valeur_constatee: conduiteAccumulee / 60,
          limite_reglementaire: 4.5,
          gravite: '4eme',
          amende_min: 135,
          amende_max: 750,
          article_loi: regle.article_loi,
        })
        // Réinitialiser pour ne pas doubler l'infraction
        conduiteAccumulee = 0
        pauseAccumulee = 0
        premierePausePrise = false
        debutSegment = null
      }
    } else if (act.type === 'REST' || act.type === 'AVAILABILITY') {
      // Temps de pause : REST ou AVAILABILITY (temps d'attente)
      const pauseDuration = act.duration_minutes

      if (conduiteAccumulee > 0) {
        pauseAccumulee += pauseDuration

        if (!premierePausePrise && pauseAccumulee >= PAUSE_MIN_BLOC) {
          premierePausePrise = true
        }

        if (pauseAccumulee >= PAUSE_TOTALE) {
          // Pause valide : réinitialiser
          conduiteAccumulee = 0
          pauseAccumulee = 0
          premierePausePrise = false
          debutSegment = null
        }
      }
    }
    // WORK : ni conduite ni repos → on laisse le compteur en l'état
  }

  return infractions
}
