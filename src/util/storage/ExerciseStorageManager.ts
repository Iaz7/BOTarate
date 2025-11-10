import { BaseStorageManager } from "./BaseStorageManager";

/**
 * Estructura de datos de ejercicios para una página
 */
export interface ExerciseData {
    pageId: string;
    exercises: Array<{ name: string; statement: string; allowed?: boolean }>;
    exerciseContext?: string;
    concepts?: string[];
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
     * @param exerciseContext Contexto de ejercicios opcional (ej. esquema de BD, especificaciones)
     * @param concepts Conceptos trabajados en los ejercicios
     * @param learningObjectives Objetivos de aprendizaje opcionales
     */
    static async saveExerciseData(
        pageId: string,
        exercises: Array<{ name: string; statement: string; allowed?: boolean }>,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string
    ): Promise<void> {
        const data: ExerciseData = {
            pageId,
            exercises,
            exerciseContext,
            concepts,
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

    /**
     * Actualiza el estado 'allowed' de un ejercicio específico
     * @param pageId ID de la página
     * @param exerciseName Nombre del ejercicio
     * @param allowed Nuevo estado de permitido/bloqueado
     */
    static async updateExerciseAllowed(pageId: string, exerciseName: string, allowed: boolean): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) {
            throw new Error(`No se encontraron datos de ejercicios para la página ${pageId}`);
        }

        const exercise = data.exercises.find(ex => ex.name === exerciseName);
        if (!exercise) {
            throw new Error(`No se encontró el ejercicio ${exerciseName}`);
        }

        exercise.allowed = allowed;

        await this.saveExerciseData(
            pageId,
            data.exercises,
            data.exerciseContext,
            data.concepts,
            data.learningObjectives
        );
    }
}
