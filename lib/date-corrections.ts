/**
 * Corrige automatiquement les années dans une liste de journées analysées
 * pour gérer les transitions d'année (ex: sept 2024 -> janv 2024 devient janv 2025)
 */
export function corrigerAnneesJournees(journees: any[]): any[] {
    if (journees.length === 0) return journees

    const corrected = [...journees]
    let yearAdjustment = 0

    for (let i = 1; i < corrected.length; i++) {
        const prevDate = new Date(corrected[i - 1].date)
        const currDate = new Date(corrected[i].date)

        // Si la date actuelle est "avant" la date précédente, on a probablement changé d'année
        if (currDate < prevDate) {
            // Vérifier si c'est une vraie régression ou juste un changement d'année
            const prevMonth = prevDate.getMonth()
            const currMonth = currDate.getMonth()

            // Si on passe de la fin d'année (>= septembre) au début (< mars), c'est un changement d'année
            if (prevMonth >= 8 && currMonth <= 2) {
                yearAdjustment++
            }
        }

        // Appliquer l'ajustement d'année si nécessaire
        if (yearAdjustment > 0) {
            const newDate = new Date(currDate)
            newDate.setFullYear(newDate.getFullYear() + yearAdjustment)
            corrected[i] = {
                ...corrected[i],
                date: newDate.toISOString().split('T')[0]
            }
        }
    }

    return corrected
}

/**
 * Corrige les années dans les infractions détectées
 */
export function corrigerAnneesInfractions(infractions: any[]): any[] {
    if (infractions.length === 0) return infractions

    // Trier les infractions par date d'abord
    const sorted = [...infractions].sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        return dateA.getTime() - dateB.getTime()
    })

    console.log('🔍 Vérification des transitions d\'année...')
    console.log('📅 Première infraction:', sorted[0].date)
    console.log('📅 Dernière infraction:', sorted[sorted.length - 1].date)

    // Détecter les transitions d'année
    let yearAdjustment = 0
    const result = sorted.map((inf, i) => {
        if (i === 0) return inf

        const prevDate = new Date(sorted[i - 1].date)
        const currDate = new Date(inf.date)

        // Si la date actuelle est "avant" la date précédente
        if (currDate < prevDate) {
            const prevMonth = prevDate.getMonth()
            const currMonth = currDate.getMonth()

            console.log(`⚠️ Régression détectée: ${sorted[i - 1].date} -> ${inf.date}`)

            // Transition d'année probable si on passe de fin d'année à début d'année
            if (prevMonth >= 8 && currMonth <= 2) {
                yearAdjustment++
                console.log(`🔧 Transition d'année détectée, ajustement: +${yearAdjustment} an(s)`)
            }
        }

        if (yearAdjustment > 0) {
            const newDate = new Date(currDate)
            newDate.setFullYear(newDate.getFullYear() + yearAdjustment)
            const corrected = newDate.toISOString().split('T')[0]
            console.log(`✏️ Correction: ${inf.date} -> ${corrected}`)
            return { ...inf, date: corrected }
        }

        return inf
    })

    const nbCorrections = result.filter((inf, i) => inf.date !== infractions[i]?.date).length
    if (nbCorrections > 0) {
        console.log(`✅ ${nbCorrections} dates corrigées au total`)
    }

    return result
}
