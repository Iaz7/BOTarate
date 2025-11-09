import { Lab } from "../storage/LabStorageManager";

export interface SavedEvaluation {
    exerciseName: string;
    solution: string;
    score: number;
    feedback: string;
    timestamp: number;
}

export interface ExerciseData {
    name: string;
    allowed: boolean;
}

export interface LabProgress {
    lab: Lab;
    isUnlocked: boolean;
    allExercises: ExerciseData[];
    challengeExercises: ExerciseData[];
    challengeEvaluations: Map<string, SavedEvaluation[]>;
    stats: {
        totalExercises: number;
        completedExercises: number;
        averageScore: number;
    };
}

export class ProgressManager {
    /**
     * Verifica si un laboratorio está completado
     * Un lab está completado si todos sus ejercicios de reto tienen nota >= 5
     */
    static isLabCompleted(progress: LabProgress): boolean {
        // Sin ejercicios de reto = completado
        if (progress.challengeExercises.length === 0) return true;

        for (const exercise of progress.challengeExercises) {
            const evaluations = progress.challengeEvaluations.get(exercise.name);
            if (!evaluations || evaluations.length === 0) {
                return false; // No ha intentado este ejercicio
            }

            const bestScore = Math.max(...evaluations.map(e => e.score));
            if (bestScore < 5) {
                return false; // No ha alcanzado la nota mínima
            }
        }

        return true;
    }

    /**
     * Verifica si todos los laboratorios requeridos anteriores están completados
     */
    static checkLabsUnlocked(
        labList: Lab[],
        currentIndex: number,
        progressData: LabProgress[]
    ): boolean {
        // Verificar todos los labs requeridos anteriores (todos en la lista son requeridos)
        for (let i = 0; i < currentIndex; i++) {
            const prevProgress = progressData[i];
            if (!prevProgress) return false;

            if (!this.isLabCompleted(prevProgress)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Carga el progreso completo de todos los laboratorios requeridos
     */
    static async loadProgressData(courseId: string): Promise<LabProgress[]> {
        try {
            // 1. Obtener la lista de laboratorios
            const labResponse = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (!labResponse.success || !labResponse.data || !labResponse.data.labs) {
                return [];
            }

            const labList: Lab[] = labResponse.data.labs;

            // Filtrar solo los laboratorios requeridos para la progresión
            const requiredLabs = labList.filter(lab => lab.required);

            // 2. Para cada laboratorio requerido, obtener ejercicios y evaluaciones
            const progressData: LabProgress[] = [];

            for (let i = 0; i < requiredLabs.length; i++) {
                const lab = requiredLabs[i];

                // Obtener ejercicios del laboratorio
                const exerciseResponse = await chrome.runtime.sendMessage({
                    action: "getExerciseData",
                    pageId: lab.id,
                });

                let allExercises: ExerciseData[] = [];
                let challengeExercises: ExerciseData[] = [];

                if (exerciseResponse.success && exerciseResponse.data) {
                    allExercises = exerciseResponse.data.exercises || [];
                    challengeExercises = allExercises.filter((ex: ExerciseData) => ex.allowed === false);
                }

                // Obtener evaluaciones para ejercicios de reto
                const challengeEvaluations = new Map<string, SavedEvaluation[]>();
                let totalScore = 0;
                let evaluatedCount = 0;

                for (const exercise of challengeExercises) {
                    const evalResponse = await chrome.runtime.sendMessage({
                        action: "getEvaluations",
                        pageId: lab.id,
                        exerciseName: exercise.name,
                    });

                    if (evalResponse.success && evalResponse.evaluations) {
                        challengeEvaluations.set(exercise.name, evalResponse.evaluations);

                        // Calcular mejor nota
                        if (evalResponse.evaluations.length > 0) {
                            const bestScore = Math.max(
                                ...evalResponse.evaluations.map((e: SavedEvaluation) => e.score)
                            );
                            totalScore += bestScore;
                            evaluatedCount++;
                        }
                    }
                }

                // Calcular estadísticas
                const stats = {
                    totalExercises: allExercises.length,
                    completedExercises: evaluatedCount,
                    averageScore: evaluatedCount > 0 ? totalScore / evaluatedCount : 0,
                };

                // Determinar si el laboratorio está desbloqueado
                let isUnlocked = true;

                if (i > 0) {
                    // Verificar si todos los laboratorios requeridos anteriores están completados
                    isUnlocked = this.checkLabsUnlocked(requiredLabs, i, progressData);
                }

                progressData.push({
                    lab,
                    isUnlocked,
                    allExercises,
                    challengeExercises,
                    challengeEvaluations,
                    stats,
                });
            }

            return progressData;
        } catch (error) {
            console.error("[ProgressManager] Error loading progress data:", error);
            return [];
        }
    }

    /**
     * Verifica si un laboratorio específico está bloqueado
     * @param pageId ID de la página/laboratorio a verificar
     * @param courseId ID del curso
     * @returns true si está bloqueado, false si está desbloqueado o no es requerido
     */
    static async isLabBlocked(pageId: string, courseId: string): Promise<boolean> {
        try {
            // 1. Obtener la lista de laboratorios
            const labResponse = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (!labResponse.success || !labResponse.data || !labResponse.data.labs) {
                return false; // Sin configuración de labs, no hay bloqueo
            }

            const labList: Lab[] = labResponse.data.labs;

            // Buscar el lab actual
            const currentLab = labList.find(lab => lab.id === pageId);

            // Si no es un lab requerido, no está bloqueado
            if (!currentLab || !currentLab.required) {
                return false;
            }

            // Filtrar solo los laboratorios requeridos
            const requiredLabs = labList.filter(lab => lab.required);

            // Encontrar el índice del lab actual en la lista de requeridos
            const currentIndex = requiredLabs.findIndex(lab => lab.id === pageId);

            // Si es el primero, no está bloqueado
            if (currentIndex <= 0) {
                return false;
            }

            // Cargar el progreso de todos los labs
            const progressData = await this.loadProgressData(courseId);

            // Verificar si está desbloqueado
            const isUnlocked = this.checkLabsUnlocked(requiredLabs, currentIndex, progressData);

            return !isUnlocked; // Bloqueado = NO desbloqueado
        } catch (error) {
            console.error("[ProgressManager] Error checking lab blocked status:", error);
            return false; // En caso de error, no bloquear
        }
    }
}
