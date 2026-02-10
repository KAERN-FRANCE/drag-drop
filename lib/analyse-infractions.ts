/**
 * ==========================================
 * ALGORITHME DE DÉTECTION DES INFRACTIONS
 * ==========================================
 *
 * CRITICITÉ : Zéro erreur tolérée
 * Conformité : Règlement CE 561/2006
 * Amendes : 135€ à 30000€ par infraction
 */

import {
    Infraction,
    JourneeAnalysee,
    SemaineAnalysee,
    TypeLigne,
    LigneRaw,
    REGLES_INFRACTIONS,
    GraviteInfraction,
} from '@/types';

// ==========================================
// UTILITAIRES DE CONVERSION
// ==========================================

/**
 * Convertit un temps au format "HH:MM" en minutes
 * @param temps - Temps au format "09:30" ou "10:00"
 * @returns Nombre de minutes
 */
export function tempsVersMinutes(temps: string | null | undefined): number {
    if (!temps || temps === '' || temps === 'null') return 0;

    const cleaned = String(temps).trim();
    if (!cleaned.includes(':')) return 0;

    const parts = cleaned.split(':');
    if (parts.length !== 2) return 0;

    const heures = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(heures) || isNaN(minutes)) return 0;

    return heures * 60 + minutes;
}

/**
 * Convertit des minutes en heures (nombre décimal)
 * @param minutes - Nombre de minutes
 * @returns Nombre d'heures (ex: 90 minutes = 1.5 heures)
 */
export function minutesVersHeures(minutes: number): number {
    return Number((minutes / 60).toFixed(2));
}

/**
 * Convertit des heures décimales en format HH:MM
 * @param heures - Nombre d'heures décimal (ex: 9.5)
 * @returns Temps au format "09:30"
 */
export function heuresVersTemps(heures: number): string {
    const h = Math.floor(heures);
    const m = Math.round((heures - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ==========================================
// IDENTIFICATION DU TYPE DE LIGNE
// ==========================================

/**
 * Identifie le type de ligne en analysant la colonne "Date"
 * @param date - Contenu de la colonne Date (ex: "Lun. 30 Sept. 2024", "Semaine 40 2024")
 * @returns Type de ligne ou null si c'est une ligne de totalisation à ignorer
 */
export function identifierTypeLigne(date: string): TypeLigne | null {
    if (!date) return null;

    const dateLower = date.toLowerCase();

    // IGNORER les lignes de totalisation (TOTAL, Quadrimestre, etc.)
    if (dateLower === 'total' || dateLower.startsWith('total ')) return null;
    if (dateLower.includes('quadrimestre')) return null;
    if (dateLower.includes('semestre')) return null;
    if (dateLower.includes('année') || dateLower.includes('annee')) return null;

    // Détecter les types valides
    const joursRegex = /(lun|mar|mer|jeu|ven|sam|dim)\./i;
    if (joursRegex.test(date)) return 'Journée';
    if (dateLower.includes('semaine')) return 'Semaine';
    if (dateLower.includes('per.') || dateLower.includes('période')) return 'Période';
    if (dateLower.includes('mois')) return 'Mois';
    if (dateLower.includes('trimestre')) return 'Trimestre';

    // Par défaut, ignorer les lignes non reconnues (probablement des totalisations)
    return null;
}

// ==========================================
// DÉTECTION DES INFRACTIONS
// ==========================================

// Tolérance pour les comparaisons (0.01h = 36 secondes)
// Pour éviter les faux positifs dus aux arrondis
const EPSILON = 0.01;

/**
 * Détecte toutes les infractions à partir des données analysées
 * @param journees - Liste des journées analysées
 * @param semaines - Liste des semaines analysées
 * @returns Liste des infractions détectées
 */
export function detecterInfractions(
    journees: JourneeAnalysee[],
    semaines: SemaineAnalysee[]
): Infraction[] {
    const infractions: Infraction[] = [];

    // 1. INFRACTIONS JOURNALIÈRES
    // Note: Les infractions de conduite > 9h sont traitées au niveau de la semaine
    // pour respecter l'exception "max 2 fois à 10h par semaine"

    // Stocker temporairement les journées pour traiter les exceptions de repos
    const journeesAvecReposReduit: JourneeAnalysee[] = [];

    for (const journee of journees) {
        // Vérifier conduite > 10h (avec tolérance pour éviter faux positifs sur 10.00)
        if (journee.conduite_heures > 10 + EPSILON) {
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'COND_JOUR_9H');
            if (!regle) continue;

            const depassement = journee.conduite_heures - 10;
            const gravite: GraviteInfraction = depassement > 1 ? '5eme' : '4eme';

            infractions.push({
                date: journee.date,
                type: 'Conduite journalière excessive',
                code: regle.code,
                detail: `${journee.conduite_heures.toFixed(2)}h de conduite (max 10h absolu, dépassement +${depassement.toFixed(2)}h)`,
                valeur_constatee: journee.conduite_heures,
                limite_reglementaire: 10,
                gravite: gravite,
                amende_min: gravite === '5eme' ? 1500 : 135,
                amende_max: gravite === '5eme' ? 3000 : 750,
                article_loi: regle.article_loi,
            });
        }

        // Vérifier repos < 9h (toujours infraction, aucune exception)
        if (journee.repos_heures > 0 && journee.repos_heures < 9) {
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'REPOS_JOUR_11H');
            if (!regle) continue;

            const gravite: GraviteInfraction = journee.repos_heures < 6 ? '5eme' : '4eme';

            infractions.push({
                date: journee.date,
                type: 'Repos journalier insuffisant',
                code: regle.code,
                detail: `${journee.repos_heures.toFixed(2)}h de repos (min 9h absolu)`,
                valeur_constatee: journee.repos_heures,
                limite_reglementaire: 9,
                gravite: gravite,
                amende_min: gravite === '5eme' ? 1500 : 135,
                amende_max: gravite === '5eme' ? 3000 : 750,
                article_loi: regle.article_loi,
            });
        }
        // Repos entre 9h et 11h : sera vérifié au niveau de la semaine (max 3x/semaine)
        else if (journee.repos_heures >= 9 && journee.repos_heures < 11) {
            journeesAvecReposReduit.push(journee);
        }

        // Vérifier amplitude
        // Règle : 12h max, extension à 14h possible si conditions respectées
        // (pause 1h, conduite ≤10h, repos ≥9h - nous vérifions seulement conduite et repos)
        if (journee.amplitude_heures > 14 + EPSILON) {
            // Amplitude >14h : infraction absolue
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'AMPLITUDE_12H');
            if (!regle) continue;

            infractions.push({
                date: journee.date,
                type: 'Amplitude journalière excessive',
                code: regle.code,
                detail: `${journee.amplitude_heures.toFixed(2)}h d'amplitude (max 14h absolu)`,
                valeur_constatee: journee.amplitude_heures,
                limite_reglementaire: 14,
                gravite: '4eme',
                amende_min: 135,
                amende_max: 750,
                article_loi: regle.article_loi,
            });
        } else if (journee.amplitude_heures > 12 + EPSILON) {
            // Amplitude 12h-14h : vérifier si les conditions visibles sont respectées
            // Extension à 14h autorisée si conduite ≤10h ET repos ≥9h
            const conduiteOk = journee.conduite_heures <= 10 + EPSILON;
            const reposOk = journee.repos_heures === 0 || journee.repos_heures >= 9;

            if (!conduiteOk || !reposOk) {
                // Conditions non respectées → infraction
                const regle = REGLES_INFRACTIONS.find((r) => r.code === 'AMPLITUDE_12H');
                if (!regle) continue;

                let raisons: string[] = [];
                if (!conduiteOk) raisons.push('conduite >10h');
                if (!reposOk) raisons.push('repos <9h');

                infractions.push({
                    date: journee.date,
                    type: 'Amplitude journalière excessive',
                    code: regle.code,
                    detail: `${journee.amplitude_heures.toFixed(2)}h d'amplitude (max 12h, extension 14h non autorisée car ${raisons.join(' et ')})`,
                    valeur_constatee: journee.amplitude_heures,
                    limite_reglementaire: 12,
                    gravite: '4eme',
                    amende_min: 135,
                    amende_max: 750,
                    article_loi: regle.article_loi,
                });
            }
            // Sinon, conditions OK → pas d'infraction (extension à 14h autorisée)
        }
    }

    // 2. INFRACTIONS HEBDOMADAIRES
    for (const semaine of semaines) {
        // Vérifier conduite > 56h (avec tolérance)
        if (semaine.conduite_heures > 56 + EPSILON) {
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'COND_HEBDO_56H');
            if (!regle) continue;

            const depassement = semaine.conduite_heures - 56;
            const gravite: GraviteInfraction = depassement > 14 ? '5eme' : '4eme';

            infractions.push({
                date: semaine.date,
                type: 'Conduite hebdomadaire excessive',
                code: regle.code,
                detail: `${semaine.conduite_heures.toFixed(2)}h de conduite sur la semaine (max 56h, dépassement +${depassement.toFixed(2)}h)`,
                valeur_constatee: semaine.conduite_heures,
                limite_reglementaire: 56,
                gravite: gravite,
                amende_min: gravite === '5eme' ? 1500 : 135,
                amende_max: gravite === '5eme' ? 3000 : 750,
                article_loi: regle.article_loi,
            });
        }

        // Vérifier les jours avec conduite entre 9h et 10h
        // Exception: autorisé 2 fois par semaine, au-delà c'est une infraction
        const jours9hA10h = semaine.journees.filter(
            (j) => j.conduite_heures > 9 + EPSILON && j.conduite_heures <= 10 + EPSILON
        );

        if (jours9hA10h.length > 2) {
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'COND_JOUR_10H_FREQ');
            if (!regle) continue;

            // Trier par heures de conduite décroissantes et marquer les jours au-delà des 2 premiers
            const joursTriés = [...jours9hA10h].sort((a, b) => b.conduite_heures - a.conduite_heures);

            // Les jours au-delà des 2 premiers sont des infractions
            for (let i = 2; i < joursTriés.length; i++) {
                const jour = joursTriés[i];
                infractions.push({
                    date: jour.date,
                    type: 'Dépassement fréquence 10h',
                    code: regle.code,
                    detail: `${jour.conduite_heures.toFixed(2)}h de conduite (>9h autorisé seulement 2 fois/semaine, ceci est le ${i + 1}ème jour)`,
                    valeur_constatee: jour.conduite_heures,
                    limite_reglementaire: 9,
                    gravite: '4eme',
                    amende_min: 135,
                    amende_max: 750,
                    article_loi: regle.article_loi,
                });
            }
        }

        // Vérifier les repos journaliers réduits (entre 9h et 11h)
        // Exception : autorisé 3 fois par semaine maximum
        const joursReposReduitDansSemaine = semaine.journees.filter(
            (j) => j.repos_heures >= 9 && j.repos_heures < 11
        );

        if (joursReposReduitDansSemaine.length > 3) {
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'REPOS_JOUR_11H');
            if (!regle) continue;

            // Trier par repos croissant et marquer les jours au-delà des 3 premiers
            const joursTriés = [...joursReposReduitDansSemaine].sort((a, b) => a.repos_heures - b.repos_heures);

            for (let i = 3; i < joursTriés.length; i++) {
                const jour = joursTriés[i];
                infractions.push({
                    date: jour.date,
                    type: 'Repos journalier réduit excessif',
                    code: regle.code,
                    detail: `${jour.repos_heures.toFixed(2)}h de repos (repos réduit 9-11h autorisé seulement 3 fois/semaine, ceci est le ${i + 1}ème jour)`,
                    valeur_constatee: jour.repos_heures,
                    limite_reglementaire: 11,
                    gravite: '4eme',
                    amende_min: 135,
                    amende_max: 750,
                    article_loi: regle.article_loi,
                });
            }
        }

        // Vérifier repos hebdomadaire < 45h
        if (semaine.repos_heures > 0 && semaine.repos_heures < 45) {
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'REPOS_HEBDO_45H');
            if (!regle) continue;

            const gravite: GraviteInfraction = semaine.repos_heures < 20 ? '5eme' : '4eme';

            infractions.push({
                date: semaine.date,
                type: 'Repos hebdomadaire insuffisant',
                code: regle.code,
                detail: `${semaine.repos_heures.toFixed(2)}h de repos hebdomadaire (min 45h ou 24h réduit avec compensation)`,
                valeur_constatee: semaine.repos_heures,
                limite_reglementaire: 45,
                gravite: gravite,
                amende_min: gravite === '5eme' ? 1500 : 135,
                amende_max: gravite === '5eme' ? 3000 : 750,
                article_loi: regle.article_loi,
            });
        }
    }

    // 3. INFRACTIONS 2 SEMAINES CONSÉCUTIVES
    for (let i = 0; i < semaines.length - 1; i++) {
        const sem1 = semaines[i];
        const sem2 = semaines[i + 1];

        const total2sem = sem1.conduite_heures + sem2.conduite_heures;

        if (total2sem > 90) {
            const regle = REGLES_INFRACTIONS.find((r) => r.code === 'COND_2SEM_90H');
            if (!regle) continue;

            const depassement = total2sem - 90;
            const gravite: GraviteInfraction = depassement > 22.5 ? '5eme' : '4eme';

            infractions.push({
                date: `${sem1.date} + ${sem2.date}`,
                type: 'Conduite 2 semaines excessive',
                code: regle.code,
                detail: `${total2sem.toFixed(2)}h de conduite sur 2 semaines consécutives (max 90h, dépassement +${depassement.toFixed(2)}h)`,
                valeur_constatee: total2sem,
                limite_reglementaire: 90,
                gravite: gravite,
                amende_min: gravite === '5eme' ? 1500 : 135,
                amende_max: gravite === '5eme' ? 3000 : 750,
                article_loi: regle.article_loi,
            });
        }
    }

    return infractions;
}

// ==========================================
// CALCUL DU SCORE DE CONFORMITÉ
// ==========================================

/**
 * Calcule le score de conformité (0-100)
 * @param nbJoursTotal - Nombre total de jours dans la période
 * @param nbInfractions - Nombre total d'infractions
 * @param infractions - Liste des infractions
 * @returns Score de conformité (0-100)
 */
export function calculerScoreConformite(
    nbJoursTotal: number,
    _nbInfractions: number,
    infractions: Infraction[]
): number {
    if (nbJoursTotal === 0) return 100;

    // Compter les infractions journalières uniquement
    const infractionsJournalieres = infractions.filter((i) => {
        const dateContientJour = /(lun|mar|mer|jeu|ven|sam|dim)\./i.test(i.date);
        return dateContientJour;
    });

    // Score de base : pourcentage de jours sans infraction
    const joursConformes = nbJoursTotal - infractionsJournalieres.length;
    let score = (joursConformes / nbJoursTotal) * 100;

    // Pénalité supplémentaire selon gravité
    const nbDelits = infractions.filter((i) => i.gravite === 'delit').length;
    const nb5eme = infractions.filter((i) => i.gravite === '5eme').length;
    const nb4eme = infractions.filter((i) => i.gravite === '4eme').length;

    score -= nbDelits * 5; // -5 points par délit
    score -= nb5eme * 2; // -2 points par 5ème classe
    score -= nb4eme * 1; // -1 point par 4ème classe

    return Math.max(0, Math.min(100, Math.round(score)));
}

// ==========================================
// PARSING DES DONNÉES BRUTES
// ==========================================

/**
 * Extrait les journées et semaines à partir des lignes brutes du fichier
 * @param data - Données brutes du fichier XLSX/CSV
 * @returns Objet contenant les journées et semaines analysées
 */
export function extraireDonneesAnalyse(data: LigneRaw[]): {
    journees: JourneeAnalysee[];
    semaines: SemaineAnalysee[];
} {
    const journees: JourneeAnalysee[] = [];
    const semaines: SemaineAnalysee[] = [];
    const semainesMap = new Map<string, SemaineAnalysee>();

    let semaineActuelle: string | null = null;

    for (const ligne of data) {
        const type = identifierTypeLigne(ligne.Date);

        // Ignorer les lignes de totalisation (TOTAL, Quadrimestre, etc.)
        if (type === null) {
            console.log(`⏭️  Ligne de totalisation ignorée: ${ligne.Date}`);
            continue;
        }

        if (type === 'Journée') {
            const journee: JourneeAnalysee = {
                date: ligne.Date,
                conduite_minutes: tempsVersMinutes(ligne.Conduite),
                conduite_heures: minutesVersHeures(tempsVersMinutes(ligne.Conduite)),
                repos_minutes: tempsVersMinutes(ligne['R.Journ']),
                repos_heures: minutesVersHeures(tempsVersMinutes(ligne['R.Journ'])),
                amplitude_minutes: tempsVersMinutes(ligne.Amplitude),
                amplitude_heures: minutesVersHeures(tempsVersMinutes(ligne.Amplitude)),
                distance_km: ligne.Distance,
            };

            journees.push(journee);

            // Ajouter la journée à la semaine actuelle
            if (semaineActuelle && semainesMap.has(semaineActuelle)) {
                const semaine = semainesMap.get(semaineActuelle)!;
                semaine.journees.push(journee);
            }
        } else if (type === 'Semaine') {
            const semaine: SemaineAnalysee = {
                numero: ligne.Date,
                date: ligne.Date,
                conduite_minutes: tempsVersMinutes(ligne.Conduite),
                conduite_heures: minutesVersHeures(tempsVersMinutes(ligne.Conduite)),
                repos_minutes: tempsVersMinutes(ligne['R. Hebdo']),
                repos_heures: minutesVersHeures(tempsVersMinutes(ligne['R. Hebdo'])),
                journees: [],
            };

            semaines.push(semaine);
            semainesMap.set(ligne.Date, semaine);
            semaineActuelle = ligne.Date;
        }
    }

    return { journees, semaines };
}

// ==========================================
// STATISTIQUES
// ==========================================

/**
 * Calcule les statistiques d'une analyse
 * @param journees - Liste des journées analysées
 * @param infractions - Liste des infractions détectées
 * @returns Statistiques de l'analyse
 */
export function calculerStatistiques(
    journees: JourneeAnalysee[],
    infractions: Infraction[]
) {
    const nbJoursTotal = journees.length;
    const nbJoursConduite = journees.filter((j) => j.conduite_heures > 0).length;
    const distanceTotale = journees.reduce((sum, j) => sum + (j.distance_km || 0), 0);

    const tempsConducteMoyen =
        nbJoursConduite > 0
            ? journees
                .filter((j) => j.conduite_heures > 0)
                .reduce((sum, j) => sum + j.conduite_heures, 0) / nbJoursConduite
            : 0;

    const joursAvecRepos = journees.filter((j) => j.repos_heures > 0);
    const reposMoyen =
        joursAvecRepos.length > 0
            ? joursAvecRepos.reduce((sum, j) => sum + j.repos_heures, 0) / joursAvecRepos.length
            : 0;

    const nb_infractions_4eme = infractions.filter((i) => i.gravite === '4eme').length;
    const nb_infractions_5eme = infractions.filter((i) => i.gravite === '5eme').length;

    return {
        temps_conduite_moyen_jour: Number(tempsConducteMoyen.toFixed(1)),
        temps_repos_moyen_jour: Number(reposMoyen.toFixed(1)),
        distance_moyenne_jour: nbJoursTotal > 0 ? Math.round(distanceTotale / nbJoursTotal) : 0,
        nb_depassements_9h: infractions.filter((i) => i.code === 'COND_JOUR_9H').length,
        nb_infractions_4eme,
        nb_infractions_5eme,
        cout_potentiel_min: infractions.reduce((sum, i) => sum + i.amende_min, 0),
        cout_potentiel_max: infractions.reduce((sum, i) => sum + i.amende_max, 0),
    };
}
