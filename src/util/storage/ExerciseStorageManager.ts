import { BaseStorageManager } from "./BaseStorageManager";

/**
 * Exercise data structure for a page
 */
export interface ExerciseData {
    pageId: string;
    exercises: Array<{ name: string; statement: string; allowed?: boolean; isTiquismiqui?: boolean }>;
    exerciseContext?: string;
    concepts?: string[];
    learningObjectives?: string;
}

/**
 * Storage manager for exercise lists
 * Saves and retrieves exercise lists identified by ExerciseAssistant
 */
export class ExerciseStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'exercise_data_';

    /**
     * Saves exercise data for a page to storage
     * @param pageId Page ID
     * @param exercises List of exercises
     * @param exerciseContext Optional exercise context (e.g., DB schema, specifications)
     * @param concepts Concepts worked on in the exercises
     * @param learningObjectives Optional learning objectives
     */
    static async saveExerciseData(
        pageId: string,
        exercises: Array<{ name: string; statement: string; allowed?: boolean; isTiquismiqui?: boolean }>,
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
     * Retrieves exercise data for a page from storage
     * @param pageId Page ID
     * @returns Exercise data or null if not exists
     */
    static async getExerciseData(pageId: string): Promise<(ExerciseData & { timestamp: number }) | null> {
        return await this.getData<ExerciseData>(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Deletes exercise data for a page from storage
     * @param pageId Page ID
     */
    static async removeExerciseData(pageId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Clears all stored exercise data
     */
    static async clearAllExerciseData(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }

    /**
     * Checks if saved data exists for a page
     * @param pageId Page ID
     * @returns true if data exists, false otherwise
     */
    static async hasExerciseData(pageId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Gets the number of days since data was saved
     * @param pageId Page ID
     * @returns Days elapsed or null if no data
     */
    static async getExerciseDataAge(pageId: string): Promise<number | null> {
        return await this.getDaysSinceLastUpdate(this.STORAGE_KEY_PREFIX, pageId);
    }

    /**
     * Updates the 'allowed' status of a specific exercise
     * @param pageId Page ID
     * @param exerciseName Exercise name
     * @param allowed New allowed/blocked status
     */
    static async updateExerciseAllowed(pageId: string, exerciseName: string, allowed: boolean): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) {
            throw new Error(`No exercise data found for page ${pageId}`);
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

    /**
     * Actualiza el estado "tiquismiqui" de un ejercicio específico
     */
    static async updateExerciseTiquismiqui(pageId: string, exerciseName: string, isTiquismiqui: boolean): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) {
            throw new Error(`No se encontraron datos de ejercicios para la página ${pageId}`);
        }

        const exercise = data.exercises.find(ex => ex.name === exerciseName);
        if (!exercise) {
            throw new Error(`No se encontró el ejercicio ${exerciseName}`);
        }

        exercise.isTiquismiqui = isTiquismiqui;

        await this.saveExerciseData(
            pageId,
            data.exercises,
            data.exerciseContext,
            data.concepts,
            data.learningObjectives
        );
    }
}
