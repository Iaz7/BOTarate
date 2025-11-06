import { BaseStorageManager } from "./BaseStorageManager";

/**
 * Estructura de un paso de explicación
 */
export interface ExplanationStep {
    explanation: string;
}

/**
 * Estructura de una explicación completa
 */
export interface Explanation {
    steps: ExplanationStep[];
}

/**
 * Estructura de datos de explicaciones para una página
 * Mapea el nombre del ejercicio a su explicación
 */
export interface ExplanationData {
    pageId: string;
    explanations: Record<string, Explanation>; // { "Ejercicio 1": { steps: [...] }, ... }
}

/**
 * Gestor de almacenamiento para explicaciones de ejercicios
 * Guarda y recupera las explicaciones generadas por el SqlTutorAssistant
 */
export class ExplanationStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'explanation_data_';

    /**
     * Guarda la explicación de un ejercicio específico
     * @param pageId ID de la página
     * @param exerciseName Nombre del ejercicio
     * @param explanation Explicación generada
     */
    static async saveExplanation(
        pageId: string,
        exerciseName: string,
        explanation: Explanation
    ): Promise<void> {
        // Obtener las explicaciones existentes para esta página
        const existingData = await this.getExplanationData(pageId);

        const data: ExplanationData = {
            pageId,
            explanations: existingData?.explanations
                ? { ...existingData.explanations, [exerciseName]: explanation }
                : { [exerciseName]: explanation }
        };

        await this.saveData(this.STORAGE_KEY_PREFIX, pageId, data);
    }

    /**
     * Recupera todas las explicaciones de una página
     * @param pageId ID de la página
     * @returns Datos de explicaciones o null si no existen
     */
    static async getExplanationData(pageId: string): Promise<(ExplanationData & { timestamp: number }) | null> {
        return await this.getData<ExplanationData>(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Recupera la explicación de un ejercicio específico
     * @param pageId ID de la página
     * @param exerciseName Nombre del ejercicio
     * @returns Explicación o null si no existe
     */
    static async getExplanation(pageId: string, exerciseName: string): Promise<Explanation | null> {
        const data = await this.getExplanationData(pageId);
        if (!data || !data.explanations[exerciseName]) {
            return null;
        }
        return data.explanations[exerciseName];
    }

    /**
     * Elimina la explicación de un ejercicio específico
     * @param pageId ID de la página
     * @param exerciseName Nombre del ejercicio
     */
    static async removeExplanation(pageId: string, exerciseName: string): Promise<void> {
        const data = await this.getExplanationData(pageId);
        if (!data) return;

        delete data.explanations[exerciseName];

        // Si no quedan explicaciones, eliminar toda la entrada
        if (Object.keys(data.explanations).length === 0) {
            await this.removeExplanationData(pageId);
        } else {
            await this.saveData(this.STORAGE_KEY_PREFIX, pageId, {
                pageId: data.pageId,
                explanations: data.explanations
            });
        }
    }

    /**
     * Elimina todas las explicaciones de una página del storage
     * @param pageId ID de la página
     */
    static async removeExplanationData(pageId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Limpia todas las explicaciones almacenadas
     */
    static async clearAllExplanationData(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }

    /**
     * Verifica si existe una explicación para un ejercicio específico
     * @param pageId ID de la página
     * @param exerciseName Nombre del ejercicio
     * @returns true si existe la explicación, false en caso contrario
     */
    static async hasExplanation(pageId: string, exerciseName: string): Promise<boolean> {
        const explanation = await this.getExplanation(pageId, exerciseName);
        return explanation !== null;
    }

    /**
     * Verifica si existen datos guardados para una página
     * @param pageId ID de la página
     * @returns true si existen datos, false en caso contrario
     */
    static async hasExplanationData(pageId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Obtiene la cantidad de días desde que se guardaron las explicaciones
     * @param pageId ID de la página
     * @returns Días transcurridos o null si no hay datos
     */
    static async getExplanationDataAge(pageId: string): Promise<number | null> {
        return await this.getDaysSinceLastUpdate(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Obtiene la lista de nombres de ejercicios con explicaciones guardadas
     * @param pageId ID de la página
     * @returns Lista de nombres de ejercicios o array vacío si no hay datos
     */
    static async getExerciseNamesWithExplanations(pageId: string): Promise<string[]> {
        const data = await this.getExplanationData(pageId);
        if (!data) return [];
        return Object.keys(data.explanations);
    }
}
