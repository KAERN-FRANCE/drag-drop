/**
 * Parser pour les fichiers Excel/CSV de tachygraphe
 */

import * as XLSX from 'xlsx';
import { LigneRaw } from '@/types';

export interface ParsedFileData {
    data: LigneRaw[];
    fileName: string;
    rowCount: number;
}

/**
 * Parse un fichier Excel ou CSV
 * @param file - Fichier à parser
 * @returns Données parsées
 */
export async function parseFile(file: File): Promise<ParsedFileData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                    reject(new Error('Impossible de lire le fichier'));
                    return;
                }

                // Lire le fichier avec xlsx
                const workbook = XLSX.read(data, { type: 'binary' });

                // Prendre la première feuille
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convertir en JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as LigneRaw[];

                if (!jsonData || jsonData.length === 0) {
                    reject(new Error('Le fichier est vide ou mal formaté'));
                    return;
                }

                // Valider la structure
                const firstRow = jsonData[0];
                const requiredColumns = ['Date', 'Conduite'];
                const missingColumns = requiredColumns.filter(col => !(col in firstRow));

                if (missingColumns.length > 0) {
                    reject(new Error(`Colonnes manquantes : ${missingColumns.join(', ')}`));
                    return;
                }

                resolve({
                    data: jsonData,
                    fileName: file.name,
                    rowCount: jsonData.length,
                });
            } catch (error) {
                reject(new Error(`Erreur lors du parsing : ${error}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Erreur lors de la lecture du fichier'));
        };

        reader.readAsBinaryString(file);
    });
}

/**
 * Valide le format d'un fichier avant de l'analyser
 * @param file - Fichier à valider
 * @returns true si le fichier est valide
 */
export function validateFileFormat(file: File): { valid: boolean; error?: string } {
    const validExtensions = ['.xlsx', '.xls', '.csv', '.c1b', '.ddd', '.v1b'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
        return {
            valid: false,
            error: `Format de fichier non supporté. Extensions acceptées : ${validExtensions.join(', ')}`,
        };
    }

    const maxSize = 30 * 1024 * 1024; // 30MB
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `Fichier trop volumineux. Taille maximale : 30 MB`,
        };
    }

    return { valid: true };
}
