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
    isTiquismiqui?: boolean;
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

export interface ProgressRequirements {
    minScoreToPass: number;
    minChallengesPercentage: number;
}

export interface CourseProgressData {
    requirements: ProgressRequirements;
    labs: LabProgress[];
}

export class ProgressManager {
    private static readonly DEFAULT_REQUIREMENTS: ProgressRequirements = {
        minScoreToPass: 5,
        minChallengesPercentage: 100,
    };

    private static normalizeRequirements(config?: Partial<ProgressRequirements>): ProgressRequirements {
        const minScore = Number.isFinite(config?.minScoreToPass) ? Number(config!.minScoreToPass) : 5;
        const minPercentage = Number.isFinite(config?.minChallengesPercentage)
            ? Number(config!.minChallengesPercentage)
            : 100;

        return {
            minScoreToPass: Math.min(Math.max(minScore, 0), 10),
            minChallengesPercentage: Math.min(Math.max(minPercentage, 0), 100),
        };
    }

    private static async getProgressRequirements(): Promise<ProgressRequirements> {
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getProgressConfig",
            });

            if (response?.success && response.config) {
                return this.normalizeRequirements(response.config);
            }
        } catch (error) {
            console.error("[ProgressManager] Error retrieving progress config:", error);
        }

        return this.DEFAULT_REQUIREMENTS;
    }

    private static async fetchExercisesForLab(labId: string): Promise<{
        allExercises: ExerciseData[];
        challengeExercises: ExerciseData[];
    }> {
        const exerciseResponse = await chrome.runtime.sendMessage({
            action: "getExerciseData",
            pageId: labId,
        });

        if (exerciseResponse?.success && exerciseResponse.data) {
            const allExercises: ExerciseData[] = exerciseResponse.data.exercises || [];
            const challengeExercises = allExercises.filter((ex: ExerciseData) => ex.allowed === false);
            return { allExercises, challengeExercises };
        }

        return {
            allExercises: [],
            challengeExercises: [],
        };
    }

    private static async fetchChallengeEvaluations(
        labId: string,
        challengeExercises: ExerciseData[]
    ): Promise<{
        challengeEvaluations: Map<string, SavedEvaluation[]>;
        totalScore: number;
        evaluatedCount: number;
    }> {
        const challengeEvaluations = new Map<string, SavedEvaluation[]>();
        let totalScore = 0;
        let evaluatedCount = 0;

        for (const exercise of challengeExercises) {
            const evalResponse = await chrome.runtime.sendMessage({
                action: "getEvaluations",
                pageId: labId,
                exerciseName: exercise.name,
            });

            if (evalResponse?.success && evalResponse.evaluations) {
                challengeEvaluations.set(exercise.name, evalResponse.evaluations);

                if (evalResponse.evaluations.length > 0) {
                    const bestScore = Math.max(...evalResponse.evaluations.map((e: SavedEvaluation) => e.score));
                    totalScore += bestScore;
                    evaluatedCount++;
                }
            }
        }

        return { challengeEvaluations, totalScore, evaluatedCount };
    }

    /**
     * Verifica si un laboratorio está completado
     * Aplica los requisitos configurados (nota mínima y porcentaje mínimo superado)
     */
    static isLabCompleted(progress: LabProgress, requirements?: ProgressRequirements): boolean {
        const criteria = requirements ?? this.DEFAULT_REQUIREMENTS;

        // Sin ejercicios de reto = completado
        if (progress.challengeExercises.length === 0) return true;

        const requiredChallenges = Math.ceil(
            (criteria.minChallengesPercentage / 100) * progress.challengeExercises.length
        );

        if (requiredChallenges === 0) {
            return true;
        }

        let passedChallenges = 0;

        for (const exercise of progress.challengeExercises) {
            const evaluations = progress.challengeEvaluations.get(exercise.name);
            if (!evaluations || evaluations.length === 0) {
                continue; // No cuenta como aprobado
            }

            const bestScore = Math.max(...evaluations.map(e => e.score));
            if (bestScore >= criteria.minScoreToPass) {
                passedChallenges++;
            }
        }

        return passedChallenges >= Math.min(requiredChallenges, progress.challengeExercises.length);
    }

    /**
     * Verifica si todos los laboratorios requeridos anteriores están completados
     */
    static checkLabsUnlocked(
        labList: Lab[],
        currentIndex: number,
        progressData: LabProgress[],
        requirements: ProgressRequirements
    ): boolean {
        // Verificar todos los labs requeridos anteriores (todos en la lista son requeridos)
        for (let i = 0; i < currentIndex; i++) {
            const prevProgress = progressData[i];
            if (!prevProgress) return false;

            if (!this.isLabCompleted(prevProgress, requirements)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Carga el progreso completo de todos los laboratorios requeridos
     */
    static async loadProgressData(courseId: string): Promise<CourseProgressData> {
        try {
            const requirements = await this.getProgressRequirements();
            // 1. Obtener la lista de laboratorios
            const labResponse = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (!labResponse?.success || !labResponse?.data?.labs) {
                return { requirements, labs: [] };
            }

            const labList: Lab[] = labResponse.data.labs;

            // Filtrar solo los laboratorios requeridos para la progresión
            const requiredLabs = labList.filter(lab => lab.required);

            // 2. Para cada laboratorio requerido, obtener ejercicios y evaluaciones
            const progressData: LabProgress[] = [];

            for (let i = 0; i < requiredLabs.length; i++) {
                const lab = requiredLabs[i];

                const { allExercises, challengeExercises } = await this.fetchExercisesForLab(lab.id);
                const { challengeEvaluations, totalScore, evaluatedCount } = await this.fetchChallengeEvaluations(
                    lab.id,
                    challengeExercises
                );

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
                    isUnlocked = this.checkLabsUnlocked(requiredLabs, i, progressData, requirements);
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

            return {
                requirements,
                labs: progressData,
            };
        } catch (error) {
            console.error("[ProgressManager] Error loading progress data:", error);
            return {
                requirements: this.DEFAULT_REQUIREMENTS,
                labs: [],
            };
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

            if (!labResponse?.success || !labResponse?.data?.labs) {
                return false; // Sin configuración de labs, no hay bloqueo
            }

            const labList: Lab[] = labResponse.data.labs;

            // Buscar el lab actual
            const currentLab = labList.find(lab => lab.id === pageId);

            // Si no es un lab requerido, no está bloqueado
            if (!currentLab?.required) {
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
            const { labs: progressData, requirements } = await this.loadProgressData(courseId);

            // Verificar si está desbloqueado
            const isUnlocked = this.checkLabsUnlocked(requiredLabs, currentIndex, progressData, requirements);

            return !isUnlocked; // Bloqueado = NO desbloqueado
        } catch (error) {
            console.error("[ProgressManager] Error checking lab blocked status:", error);
            return false; // En caso de error, no bloquear
        }
    }
}
