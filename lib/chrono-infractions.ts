/**
 * Détection d'infractions depuis les activités chronologiques (timestamps précis)
 *
 * Conformité : Règlement CE 561/2006
 * Source : fichiers Excel chronologiques (décompte chronologique)
 *
 * - Les activités qui chevauchent minuit sont découpées entre les deux jours
 * - Détection PAUSE 4h30 avec prise en charge de la pause fractionnée (15+30 min)
 */

import type { Activity, Infraction, GraviteInfraction } from '@/types'
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

/**
 * Formate un nombre d'heures décimal en "XhYY" (ex: 4.53 → "4h32", 11.0 → "11h")
 */
function fmtHM(h: number): string {
  const totalMin = Math.round(Math.abs(h) * 60)
  const hrs = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return min > 0 ? `${hrs}h${min.toString().padStart(2, '0')}` : `${hrs}h`
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

// ── Gravité EU 2016/403 Annexe III ──────────────────────

type GravityResult = { gravite: GraviteInfraction; amende_min: number; amende_max: number }

const AMENDE: Record<GraviteInfraction, [number, number]> = {
  '3eme': [90, 135],
  '4eme': [135, 750],
  '5eme': [1500, 3000],
  'delit': [3750, 7500],
}

/**
 * Retourne la gravité selon EU 2016/403 Annexe III.
 * @param type  Clé du type d'infraction
 * @param value Valeur constatée (heures)
 */
function getGravity(type: string, value: number): GravityResult {
  let g: GraviteInfraction = '4eme'

  switch (type) {
    case 'COND_JOUR':
      // h de conduite journalière — EU 2016/403 Annexe III
      // MSI (délit) : ≥ 13h30 (50% dépassement du seuil 9h)
      // VSI (5ème)  : ≥ 11h
      // SI  (4ème)  : ≥ 10h à < 11h
      // SI  (3ème)  : < 10h (dépassement mineur)
      if (value >= 13.5)     g = 'delit'
      else if (value >= 11)  g = '5eme'
      else if (value >= 10)  g = '4eme'
      else                    g = '3eme'
      break

    case 'REPOS_JOUR':
      // h de repos journalier réel — EU 2016/403 Annexe III
      // MSI (délit) : < 7h
      // VSI (5ème)  : < 8h30
      // SI  (4ème)  : < 10h
      // SI  (3ème)  : ≥ 10h à < 11h
      if (value < 7)        g = 'delit'
      else if (value < 8.5) g = '5eme'
      else if (value < 10)  g = '4eme'
      else                   g = '3eme'
      break

    case 'PAUSE':
      // h de conduite sans pause — EU 2016/403 Annexe III
      // VSI (5ème)  : ≥ 6h (pas de MSI dans le règlement)
      // SI  (4ème)  : ≥ 5h15 à < 6h
      // SI  (3ème)  : > 4h30 à < 5h15
      if (value >= 6)        g = '5eme'
      else if (value >= 5.25) g = '4eme'
      else                    g = '3eme'
      break

    case 'COND_HEBDO':
      // h de conduite hebdomadaire — EU 2016/403 Annexe III
      // VSI (5ème) : ≥ 70h (25% dépassement de 56h)
      // SI  (4ème) : ≥ 64h
      // SI  (3ème) : > 56h à < 64h (ex: ≥ 60h)
      if (value >= 70)      g = '5eme'
      else if (value >= 64) g = '4eme'
      else                   g = '3eme'
      break

    case 'COND_2SEM':
      // h de conduite bi-hebdomadaire — EU 2016/403 Annexe III
      // VSI (5ème) : ≥ 112h30 (25% dépassement de 90h)
      // SI  (4ème) : ≥ 105h
      // SI  (3ème) : > 90h à < 105h
      if (value >= 112.5)    g = '5eme'
      else if (value >= 105) g = '4eme'
      else                    g = '3eme'
      break

    case 'REPOS_HEBDO':
      // h de manque (shortfall) par rapport au minimum requis — EU 2016/403
      // VSI (5ème)  : ≥ 9h de manque
      // SI  (4ème)  : ≥ 3h de manque
      // SI  (3ème)  : < 3h de manque
      if (value >= 9)       g = '5eme'
      else if (value >= 3)  g = '4eme'
      else                   g = '3eme'
      break

    default:
      g = '4eme'
  }

  const [amende_min, amende_max] = AMENDE[g]
  return { gravite: g, amende_min, amende_max }
}

// ── Structures internes ───────────────────────────────

interface QualifyingRest {
  startTs: number
  endTs: number
  durationMin: number
  type: 'normal' | 'reduced' | 'split'
}

interface WeeklyRestBlock {
  startTs: number
  endTs: number
  durationMin: number
  type: 'normal' | 'reduced'
}

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

export function detecterInfractionsChronologiques(
  activities: Activity[],
  options?: { skipPause?: boolean }
): Infraction[] {
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
  // 1b. Fusionner REST en blocs + repos qualifiants
  //     (nécessaire pour amplitude et repos journalier)
  // ══════════════════════════════════════════════════
  interface RestBlock { startTs: number; endTs: number; durationMin: number }
  const restBlocks: RestBlock[] = []

  // Fusion tolérante : les courtes interruptions non-DRIVING (≤5 min)
  // ne cassent pas un bloc de repos (ex: AVAILABILITY de 2 min pendant la nuit)
  let currentRestBlock: RestBlock | null = null

  for (const act of sorted) {
    const s = new Date(act.start).getTime()
    const e = new Date(act.end).getTime()

    if (act.type === 'REST') {
      if (currentRestBlock && s <= currentRestBlock.endTs + 60_000) {
        // REST adjacent (≤1min gap) → fusionner
        currentRestBlock.endTs = Math.max(currentRestBlock.endTs, e)
        currentRestBlock.durationMin = (currentRestBlock.endTs - currentRestBlock.startTs) / 60_000
      } else if (currentRestBlock && (s - currentRestBlock.endTs) / 60_000 <= 5) {
        // Courte interruption ≤5min → continuer le bloc repos
        currentRestBlock.endTs = Math.max(currentRestBlock.endTs, e)
        currentRestBlock.durationMin = (currentRestBlock.endTs - currentRestBlock.startTs) / 60_000
      } else {
        if (currentRestBlock) restBlocks.push(currentRestBlock)
        currentRestBlock = { startTs: s, endTs: e, durationMin: (e - s) / 60_000 }
      }
    } else if (act.type === 'DRIVING') {
      // La conduite interrompt toujours un repos
      if (currentRestBlock) { restBlocks.push(currentRestBlock); currentRestBlock = null }
    } else {
      // AVAILABILITY, WORK, UNKNOWN — interrompt seulement si > 5min
      if (currentRestBlock && act.duration_minutes > 5) {
        restBlocks.push(currentRestBlock); currentRestBlock = null
      }
      // ≤5min : le repos continue (endTs sera étendu au prochain REST)
    }
  }
  if (currentRestBlock) restBlocks.push(currentRestBlock)

  const DAILY_REST_MIN = 9 * 60 - 1
  const DAILY_REST_NORMAL = 11 * 60 - 1
  const SPLIT_FIRST_MIN = 3 * 60 - 1
  const SPLIT_SECOND_MIN = 9 * 60 - 1

  const qualifyingRests: QualifyingRest[] = []

  for (let idx = 0; idx < restBlocks.length; idx++) {
    const rb = restBlocks[idx]
    if (rb.durationMin >= DAILY_REST_MIN) {
      qualifyingRests.push({
        startTs: rb.startTs, endTs: rb.endTs, durationMin: rb.durationMin,
        type: rb.durationMin >= DAILY_REST_NORMAL ? 'normal' : 'reduced',
      })
    }
  }

  // Paires fractionnées 3h + 9h (Art. 8§2)
  for (let idx = 0; idx < restBlocks.length; idx++) {
    const rb = restBlocks[idx]
    if (rb.durationMin >= SPLIT_FIRST_MIN && rb.durationMin < DAILY_REST_MIN) {
      for (let j = idx + 1; j < restBlocks.length; j++) {
        const rb2 = restBlocks[j]
        if (rb2.durationMin >= SPLIT_SECOND_MIN) {
          const gapH = (rb2.startTs - rb.endTs) / 3_600_000
          if (gapH <= 24) {
            const existingQR = qualifyingRests.find(
              qr => qr.startTs === rb2.startTs && qr.endTs === rb2.endTs
            )
            if (existingQR) {
              existingQR.startTs = rb.startTs
              existingQR.durationMin = rb.durationMin + rb2.durationMin
              existingQR.type = 'split'
            }
          }
          break
        }
      }
    }
  }

  qualifyingRests.sort((a, b) => a.startTs - b.startTs)

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
        const grav = getGravity('COND_JOUR', h)
        infractions.push({
          date: jour.dateLabel, type: 'Conduite journalière excessive', code: regle.code,
          detail: `${fmtHM(h)} de conduite (max 10h, +${fmtHM(dep)})`,
          valeur_constatee: h, limite_reglementaire: 10,
          ...grav,
          article_loi: regle.article_loi,
        })
      }
    }

    // ── Conduite > 9h : max 2 fois/semaine (les jours >10h comptent aussi) ──
    const jours9h10h = week.days.filter(
      d => d.drivingMinutes > (9 + EPSILON) * 60
    )
    if (jours9h10h.length > 2) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_JOUR_10H_FREQ')!
      const tries = [...jours9h10h].sort((a, b) => b.drivingMinutes - a.drivingMinutes)
      for (let i = 2; i < tries.length; i++) {
        const jour = tries[i]
        const h = jour.drivingMinutes / 60
        const grav = getGravity('COND_JOUR', h)
        infractions.push({
          date: jour.dateLabel, type: 'Dépassement fréquence 10h', code: regle.code,
          detail: `${fmtHM(h)} (>9h autorisé 2 fois/semaine max, ceci est le ${i + 1}ème)`,
          valeur_constatee: h, limite_reglementaire: 9,
          ...grav,
          article_loi: regle.article_loi,
        })
      }
    }

    // ── Amplitude — seuil absolu 15h ──
    // CE 561/2006 : amplitude max = 24h - repos min (9h réduit) = 15h
    // Les insuffisances de repos (<9h, <11h) sont détectées séparément (section 2b)
    for (const jour of week.days) {
      const amp = jour.amplitudeMinutes / 60
      if (amp > 15 + EPSILON) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'AMPLITUDE_12H')!
        infractions.push({
          date: jour.dateLabel, type: 'Amplitude journalière excessive', code: regle.code,
          detail: `${fmtHM(amp)} d'amplitude (max 15h, repos min 9h)`,
          valeur_constatee: amp, limite_reglementaire: 15,
          gravite: '4eme', amende_min: 135, amende_max: 750,
          article_loi: regle.article_loi,
        })
      }
    }
  }

  // ══════════════════════════════════════════════════
  // 2b. Repos journalier — vérification par périodes de travail
  // ══════════════════════════════════════════════════

  // Déterminer les périodes de travail (gaps entre repos qualifiants)

  interface WorkGap { afterRestEnd: number; beforeRestStart: number; restType: 'normal' | 'reduced' | 'split' }
  const gaps: WorkGap[] = []

  if (qualifyingRests.length === 0 && sorted.length > 1) {
    gaps.push({
      afterRestEnd: new Date(sorted[0].start).getTime(),
      beforeRestStart: new Date(sorted[sorted.length - 1].end).getTime(),
      restType: 'normal',
    })
  } else {
    for (let i = 0; i < qualifyingRests.length - 1; i++) {
      gaps.push({
        afterRestEnd: qualifyingRests[i].endTs,
        beforeRestStart: qualifyingRests[i + 1].startTs,
        restType: qualifyingRests[i + 1].type, // le repos qui termine cette période
      })
    }
  }

  // Pour chaque gap > 24h : repos journalier insuffisant
  // UNE seule infraction par gap (pas de slots fantômes)
  for (const gap of gaps) {
    const gapDurationH = (gap.beforeRestStart - gap.afterRestEnd) / 3_600_000
    if (gapDurationH <= 24) continue

    // Plus long repos trouvé dans le gap
    const blocksInGap = restBlocks
      .filter(rb => rb.startTs >= gap.afterRestEnd && rb.endTs <= gap.beforeRestStart)
      .sort((a, b) => b.durationMin - a.durationMin)

    const longestRestMin = blocksInGap[0]?.durationMin ?? 0

    if (longestRestMin < DAILY_REST_MIN) {
      const h = longestRestMin / 60
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_JOUR_11H')!
      const grav = getGravity('REPOS_JOUR', h)
      const estimatedTs = gap.afterRestEnd + 24 * 3_600_000
      const dateKey = extractLocalDate(
        new Date(Math.min(estimatedTs, gap.beforeRestStart)).toISOString()
      )
      infractions.push({
        date: formatDateFr(dateKey),
        type: 'Repos journalier insuffisant',
        code: regle.code,
        detail: `${fmtHM(h)} de repos consécutif (min 9h)`,
        valeur_constatee: h,
        limite_reglementaire: 9,
        ...grav,
        article_loi: regle.article_loi,
      })
    }
  }

  // ══════════════════════════════════════════════════
  // 2c. Repos hebdomadaire — blocs consécutifs ≥ 24h
  //     CE 561/2006 Art. 8§6 :
  //     - Normal : ≥ 45h consécutives
  //     - Réduit : ≥ 24h (max 2 réduits consécutifs)
  //     - Doit commencer ≤ 6×24h après fin du précédent
  // ══════════════════════════════════════════════════
  const WEEKLY_REST_REDUCED_MIN = 24 * 60 - 1  // 24h - 1min tolérance
  const WEEKLY_REST_NORMAL_MIN = 45 * 60 - 1   // 45h - 1min tolérance

  const weeklyRests: WeeklyRestBlock[] = restBlocks
    .filter(rb => rb.durationMin >= WEEKLY_REST_REDUCED_MIN)
    .map(rb => ({
      startTs: rb.startTs,
      endTs: rb.endTs,
      durationMin: rb.durationMin,
      type: rb.durationMin >= WEEKLY_REST_NORMAL_MIN ? 'normal' as const : 'reduced' as const,
    }))

  // Règle 6×24h : gap entre repos hebdomadaires consécutifs ≤ 144h
  // Protection bornes : on ignore le premier et dernier gap (données potentiellement incomplètes)
  // Il faut ≥ 3 repos hebdo pour avoir au moins 1 gap interne fiable
  if (weeklyRests.length >= 3) {
    for (let i = 1; i < weeklyRests.length - 2; i++) {
      const gapH = (weeklyRests[i + 1].startTs - weeklyRests[i].endTs) / 3_600_000
      if (gapH > 144 + EPSILON) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_HEBDO_45H')!
        const shortfall = gapH - 144
        const grav = getGravity('REPOS_HEBDO', shortfall)
        const dateKey = extractLocalDate(new Date(weeklyRests[i].endTs + 144 * 3_600_000).toISOString())
        infractions.push({
          date: formatDateFr(dateKey),
          type: 'Repos hebdomadaire manquant (6×24h)',
          code: regle.code,
          detail: `${fmtHM(gapH)} sans repos hebdomadaire (max 144h entre deux repos)`,
          valeur_constatee: gapH,
          limite_reglementaire: 144,
          ...grav,
          article_loi: regle.article_loi,
        })
      }
    }
  }

  // Max 2 repos hebdomadaires réduits consécutifs
  // Protection bornes : on ignore le 1er repos hebdo (peut être précédé d'un normal hors données)
  // Il faut ≥ 3 repos hebdo pour pouvoir détecter "3ème réduit consécutif" de manière fiable
  if (weeklyRests.length >= 3) {
    let consecutiveReduced = 0
    for (let i = 1; i < weeklyRests.length; i++) {
      const wr = weeklyRests[i]
      if (wr.type === 'reduced') {
        consecutiveReduced++
        if (consecutiveReduced > 2) {
          const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_HEBDO_45H')!
          const shortfall = 45 - wr.durationMin / 60
          const grav = getGravity('REPOS_HEBDO', shortfall)
          const dateKey = extractLocalDate(new Date(wr.startTs).toISOString())
          infractions.push({
            date: formatDateFr(dateKey),
            type: 'Repos hebdomadaire réduit excessif',
            code: regle.code,
            detail: `${fmtHM(wr.durationMin / 60)} (3ème repos réduit consécutif, max 2 autorisés)`,
            valeur_constatee: wr.durationMin / 60,
            limite_reglementaire: 45,
            ...grav,
            article_loi: regle.article_loi,
          })
        }
      } else {
        consecutiveReduced = 0
      }
    }
  }

  // ── Repos réduit journalier : max 3 entre deux repos hebdomadaires ──
  // CE 561/2006 Art. 8§4
  const countReducedBetween = (startTs: number, endTs: number) => {
    return qualifyingRests.filter(qr =>
      qr.startTs >= startTs && qr.endTs <= endTs
      && qr.durationMin < DAILY_REST_NORMAL
      && qr.durationMin >= DAILY_REST_MIN
      && qr.durationMin < WEEKLY_REST_REDUCED_MIN // exclure les repos hebdo
    )
  }

  if (weeklyRests.length >= 2) {
    for (let i = 0; i < weeklyRests.length - 1; i++) {
      const periodStart = weeklyRests[i].endTs
      const periodEnd = weeklyRests[i + 1].startTs
      const reducedInPeriod = countReducedBetween(periodStart, periodEnd)

      if (reducedInPeriod.length > 3) {
        const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_JOUR_11H')!
        const sortedReduced = [...reducedInPeriod].sort((a, b) => a.durationMin - b.durationMin)
        for (let j = 3; j < sortedReduced.length; j++) {
          const qr = sortedReduced[j]
          const h = qr.durationMin / 60
          const grav = getGravity('REPOS_JOUR', h)
          const dateKey = extractLocalDate(new Date(qr.startTs).toISOString())
          infractions.push({
            date: formatDateFr(dateKey),
            type: 'Repos journalier réduit excessif',
            code: regle.code,
            detail: `${fmtHM(h)} (repos réduit autorisé 3 fois entre repos hebdo, ceci est le ${j + 1}ème)`,
            valeur_constatee: h,
            limite_reglementaire: 11,
            ...grav,
            article_loi: regle.article_loi,
          })
        }
      }
    }
  } else if (weeklyRests.length <= 1) {
    // Données courtes : compter sur toute la période
    const allReduced = qualifyingRests.filter(qr =>
      qr.durationMin < DAILY_REST_NORMAL
      && qr.durationMin >= DAILY_REST_MIN
      && qr.durationMin < WEEKLY_REST_REDUCED_MIN
    )
    if (allReduced.length > 3) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'REPOS_JOUR_11H')!
      const sortedReduced = [...allReduced].sort((a, b) => a.durationMin - b.durationMin)
      for (let j = 3; j < sortedReduced.length; j++) {
        const qr = sortedReduced[j]
        const h = qr.durationMin / 60
        const grav = getGravity('REPOS_JOUR', h)
        const dateKey = extractLocalDate(new Date(qr.startTs).toISOString())
        infractions.push({
          date: formatDateFr(dateKey),
          type: 'Repos journalier réduit excessif',
          code: regle.code,
          detail: `${fmtHM(h)} (repos réduit autorisé 3 fois entre repos hebdo, ceci est le ${j + 1}ème)`,
          valeur_constatee: h,
          limite_reglementaire: 11,
          ...grav,
          article_loi: regle.article_loi,
        })
      }
    }
  }

  // ══════════════════════════════════════════════════
  // 3. Infractions hebdomadaires — conduite
  // ══════════════════════════════════════════════════
  for (const week of weekStats) {
    const conduiteH = week.drivingMinutes / 60
    if (conduiteH > 56 + EPSILON) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_HEBDO_56H')!
      const dep = conduiteH - 56
      const grav = getGravity('COND_HEBDO', conduiteH)
      infractions.push({
        date: week.weekLabel, type: 'Conduite hebdomadaire excessive', code: regle.code,
        detail: `${fmtHM(conduiteH)} (max 56h, +${fmtHM(dep)})`,
        valeur_constatee: conduiteH, limite_reglementaire: 56,
        ...grav,
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
    if (total > 90 + EPSILON) {
      const regle = REGLES_INFRACTIONS.find(r => r.code === 'COND_2SEM_90H')!
      const dep = total - 90
      const grav = getGravity('COND_2SEM', total)
      infractions.push({
        date: `${w1.weekLabel} + ${w2.weekLabel}`, type: 'Conduite 2 semaines excessive', code: regle.code,
        detail: `${fmtHM(total)} sur 2 semaines (max 90h, +${fmtHM(dep)})`,
        valeur_constatee: total, limite_reglementaire: 90,
        ...grav,
        article_loi: regle.article_loi,
      })
    }
  }

  // ══════════════════════════════════════════════════
  // 5. Pause 4h30 — Art. 7 CE 561/2006
  //    Pause fractionnée : 1ère partie ≥ 15 min + 2ème partie ≥ 30 min
  //    (conduite possible entre les deux parties)
  //    SKIP si format résumé journalier (pas de chronologie intra-journalière)
  if (options?.skipPause) return infractions
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
        const h = conducteSinceBreak / 60
        const grav = getGravity('PAUSE', h)
        const dateLabel = segmentStart
          ? formatDateFr(extractLocalDate(segmentStart))
          : formatDateFr(extractLocalDate(act.start))
        infractions.push({
          date: dateLabel, type: 'Pause 4h30 manquante', code: regle.code,
          detail: `${fmtHM(h)} de conduite sans pause réglementaire`,
          valeur_constatee: h, limite_reglementaire: 4.5,
          ...grav,
          article_loi: regle.article_loi,
        })
        // Reporter l'excédent au-delà de 4h30 sur la fenêtre suivante
        const excess = conducteSinceBreak - PAUSE_LIMIT
        conducteSinceBreak = excess > 0 ? excess : 0
        breakPhase = 0
        firstBreakMin = 0
        segmentStart = act.start
      }

    } else if (act.type === 'REST' && conducteSinceBreak > 0) {
      // AVAILABILITY (disponibilité) n'est PAS une pause réglementaire (CE 561/2006 Art. 7)
      // Seule la période de REST compte comme coupure valide
      const dur = act.duration_minutes

      if (breakPhase === 0) {
        if (dur >= BREAK_FULL) {
          conducteSinceBreak = 0; breakPhase = 0; firstBreakMin = 0; segmentStart = null
        } else if (dur >= BREAK1_MIN) {
          breakPhase = 1; firstBreakMin = dur
        }
      } else {
        if (dur >= BREAK2_MIN) {
          conducteSinceBreak = 0; breakPhase = 0; firstBreakMin = 0; segmentStart = null
        } else if (dur >= BREAK1_MIN) {
          firstBreakMin = dur
        }
      }
    }
  }

  return infractions
}
