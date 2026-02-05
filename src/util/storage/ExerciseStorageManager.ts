import type { ExerciseDataForStorage, Lab } from "../../types/shared";
import { BaseStorageManager } from "./BaseStorageManager";
import { LabStorageManager } from "./LabStorageManager";

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
        exercises: Array<{ name: string; statement: string; allowed?: boolean; isPicky?: boolean }> | import("../../types/shared").Exercise[],
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string
    ): Promise<void> {
        const data: ExerciseDataForStorage = {
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
    static async getExerciseData(pageId: string): Promise<(ExerciseDataForStorage & { timestamp: number }) | null> {
        return await this.getData<ExerciseDataForStorage>(this.STORAGE_KEY_PREFIX, pageId);
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
     * Updates the "picky" status of a specific exercise
     */
    static async updateExercisePicky(pageId: string, exerciseName: string, isPicky: boolean): Promise<void> {
        const data = await this.getExerciseData(pageId);
        if (!data) {
            throw new Error(`No se encontraron datos de ejercicios para la página ${pageId}`);
        }

        const exercise = data.exercises.find(ex => ex.name === exerciseName);
        if (!exercise) {
            throw new Error(`No se encontró el ejercicio ${exerciseName}`);
        }

        exercise.isPicky = isPicky;

        await this.saveExerciseData(
            pageId,
            data.exercises,
            data.exerciseContext,
            data.concepts,
            data.learningObjectives
        );
    }

    /**
     * Gets accumulated concepts from current lab and all previous required labs
     * This combines concepts from all labs up to and including the specified pageId,
     * removing duplicates while preserving the order of first occurrence.
     * 
     * @param courseId Course ID
     * @param pageId Current page/lab ID
     * @returns Array of unique concepts from current and previous labs
     */
    static async getAccumulatedConcepts(courseId: string, pageId: string): Promise<string[]> {
        const labData = await LabStorageManager.getLabData(courseId);
        if (!labData) {
            // If no lab data, just return concepts from current page
            const currentData = await this.getExerciseData(pageId);
            return currentData?.concepts || [];
        }

        const allLabs = labData.labs;

        // Filter only required labs (labs with context that are marked as required)
        const requiredLabs = allLabs.filter((lab: Lab) => lab.required);

        // Find index of current lab in required labs
        const currentLabIndex = requiredLabs.findIndex((lab: Lab) => lab.id === pageId);

        // Get labs up to and including the current one
        // If current lab is not in required labs, we include all required labs before it by order
        let labsToInclude: Lab[];
        if (currentLabIndex >= 0) {
            labsToInclude = requiredLabs.slice(0, currentLabIndex + 1);
        } else {
            // Current lab is not required - include all required labs that come before it in allLabs
            const currentIndexInAll = allLabs.findIndex((lab: Lab) => lab.id === pageId);
            labsToInclude = requiredLabs.filter((_, idx) => {
                const labInAll = allLabs.findIndex((l: Lab) => l.id === requiredLabs[idx].id);
                return labInAll < currentIndexInAll;
            });
        }

        // Collect concepts from all previous labs, maintaining order
        const conceptsSet = new Set<string>();
        const orderedConcepts: string[] = [];

        for (const lab of labsToInclude) {
            const exerciseData = await this.getExerciseData(lab.id);
            if (exerciseData?.concepts) {
                for (const concept of exerciseData.concepts) {
                    if (!conceptsSet.has(concept)) {
                        conceptsSet.add(concept);
                        orderedConcepts.push(concept);
                    }
                }
            }
        }

        // Also add concepts from the current page if not already included
        const currentData = await this.getExerciseData(pageId);
        if (currentData?.concepts) {
            for (const concept of currentData.concepts) {
                if (!conceptsSet.has(concept)) {
                    conceptsSet.add(concept);
                    orderedConcepts.push(concept);
                }
            }
        }

        return orderedConcepts;
    }
}
