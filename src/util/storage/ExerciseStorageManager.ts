import { BaseStorageManager } from "./BaseStorageManager";

/**
 * Estructura de datos de ejercicios para una página
 */
export interface ExerciseData {
    pageId: string;
    exercises: Array<{ name: string; statement: string }>;
    dbSchema?: string;
    sqlInstructions?: string[];
    learningObjectives?: string;
}

/**
 * Gestor de almacenamiento para listas de ejercicios
 * Guarda y recupera las listas de ejercicios identificados por el ExerciseAssistant
 */
export class ExerciseStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'exercise_data_';

    /**
     * Guarda los datos de ejercicios de una página en el storage
     * @param pageId ID de la página
     * @param exercises Lista de ejercicios
     * @param dbSchema Esquema de BD opcional
     * @param sqlInstructions Instrucciones SQL opcionales
     * @param learningObjectives Objetivos de aprendizaje opcionales
     */
    static async saveExerciseData(
        pageId: string,
        exercises: Array<{ name: string; statement: string }>,
        dbSchema?: string,
        sqlInstructions?: string[],
        learningObjectives?: string
    ): Promise<void> {
        const data: ExerciseData = {
            pageId,
            exercises,
            dbSchema,
            sqlInstructions,
            learningObjectives
        };

        await this.saveData(this.STORAGE_KEY_PREFIX, pageId, data);
    }

    /**
     * Recupera los datos de ejercicios de una página del storage
     * @param pageId ID de la página
     * @returns Datos de ejercicios o null si no existen
     */
    static async getExerciseData(pageId: string): Promise<(ExerciseData & { timestamp: number }) | null> {
        return await this.getData<ExerciseData>(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Elimina los datos de ejercicios de una página del storage
     * @param pageId ID de la página
     */
    static async removeExerciseData(pageId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Limpia todos los datos de ejercicios almacenados
     */
    static async clearAllExerciseData(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }

    /**
     * Verifica si existen datos guardados para una página
     * @param pageId ID de la página
     * @returns true si existen datos, false en caso contrario
     */
    static async hasExerciseData(pageId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Obtiene la cantidad de días desde que se guardaron los datos
     * @param pageId ID de la página
     * @returns Días transcurridos o null si no hay datos
     */
    static async getExerciseDataAge(pageId: string): Promise<number | null> {
        return await this.getDaysSinceLastUpdate(this.STORAGE_KEY_PREFIX, pageId);
    }
}
