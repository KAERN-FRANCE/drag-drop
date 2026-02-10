/**
 * Types pour le système d'analyse de fichiers tachygraphe
 */

export type GraviteInfraction = '3eme' | '4eme' | '5eme' | 'delit';

export interface Infraction {
    date: string;
    type: string;
    code: string;
    detail: string;
    valeur_constatee: number;
    limite_reglementaire: number;
    gravite: GraviteInfraction;
    amende_min: number;
    amende_max: number;
    article_loi: string;
}

export interface JourneeAnalysee {
    date: string;
    conduite_minutes: number;
    conduite_heures: number;
    repos_minutes: number;
    repos_heures: number;
    amplitude_minutes: number;
    amplitude_heures: number;
    distance_km: number;
}

export interface SemaineAnalysee {
    numero: string;
    date: string;
    conduite_minutes: number;
    conduite_heures: number;
    repos_minutes: number;
    repos_heures: number;
    journees: JourneeAnalysee[];
}

export type TypeLigne = 'Journée' | 'Semaine' | 'Période' | 'Mois' | 'Trimestre';

export interface LigneRaw {
    Date: string;
    Conduite: string;
    'R.Journ': string;
    Amplitude: string;
    Distance: number;
    'R. Hebdo': string;
    [key: string]: any;
}

export interface RegleInfraction {
    code: string;
    label: string;
    description: string;
    limite: number | string;
    gravite_defaut: GraviteInfraction;
    article_loi: string;
}

export const REGLES_INFRACTIONS: RegleInfraction[] = [
    {
        code: 'COND_JOUR_9H',
        label: 'Conduite journalière > 9h',
        description: 'Dépassement du temps de conduite journalier (9h max, extension 10h possible 2 fois/semaine)',
        limite: 9,
        gravite_defaut: '4eme',
        article_loi: 'Art. R. 3312-3',
    },
    {
        code: 'COND_JOUR_10H_FREQ',
        label: 'Conduite > 10h trop fréquent',
        description: 'Extension à 10h utilisée plus de 2 fois par semaine',
        limite: '2 fois/semaine',
        gravite_defaut: '4eme',
        article_loi: 'Art. R. 3312-3',
    },
    {
        code: 'REPOS_JOUR_11H',
        label: 'Repos journalier < 11h',
        description: 'Repos journalier insuffisant (11h min, réduction à 9h possible 3 fois/semaine)',
        limite: 11,
        gravite_defaut: '4eme',
        article_loi: 'Art. R. 3312-4',
    },
    {
        code: 'AMPLITUDE_12H',
        label: 'Amplitude > 12h',
        description: 'Amplitude de travail excessive (12h max, extension 14h sous conditions)',
        limite: 12,
        gravite_defaut: '4eme',
        article_loi: 'Art. R. 3312-5',
    },
    {
        code: 'COND_HEBDO_56H',
        label: 'Conduite hebdomadaire > 56h',
        description: 'Dépassement du temps de conduite hebdomadaire',
        limite: 56,
        gravite_defaut: '4eme',
        article_loi: 'Art. R. 3312-6',
    },
    {
        code: 'REPOS_HEBDO_45H',
        label: 'Repos hebdomadaire < 45h',
        description: 'Repos hebdomadaire insuffisant (45h min, réduction à 24h possible avec compensation)',
        limite: 45,
        gravite_defaut: '4eme',
        article_loi: 'Art. R. 3312-7',
    },
    {
        code: 'COND_2SEM_90H',
        label: 'Conduite 2 semaines > 90h',
        description: 'Dépassement du temps de conduite sur 2 semaines consécutives',
        limite: 90,
        gravite_defaut: '4eme',
        article_loi: 'Art. R. 3312-6',
    },
];
