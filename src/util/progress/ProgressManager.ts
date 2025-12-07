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
     * Checks if a lab is completed
     * Applies configured requirements (minimum score and minimum percentage passed)
     */
    static isLabCompleted(progress: LabProgress, requirements?: ProgressRequirements): boolean {
        const criteria = requirements ?? this.DEFAULT_REQUIREMENTS;

        // No challenge exercises = completed
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
                continue; // Does not count as passed
            }

            const bestScore = Math.max(...evaluations.map(e => e.score));
            if (bestScore >= criteria.minScoreToPass) {
                passedChallenges++;
            }
        }

        return passedChallenges >= Math.min(requiredChallenges, progress.challengeExercises.length);
    }

    /**
     * Checks if all previous required labs are completed
     */
    static checkLabsUnlocked(
        labList: Lab[],
        currentIndex: number,
        progressData: LabProgress[],
        requirements: ProgressRequirements
    ): boolean {
        // Check all previous required labs (all in the list are required)
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
     * Loads full progress of all required labs
     */
    static async loadProgressData(courseId: string): Promise<CourseProgressData> {
        try {
            const requirements = await this.getProgressRequirements();
            // 1. Get lab list
            const labResponse = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (!labResponse?.success || !labResponse?.data?.labs) {
                return { requirements, labs: [] };
            }

            const labList: Lab[] = labResponse.data.labs;

            // Filter only required labs for progression
            const requiredLabs = labList.filter(lab => lab.required);

            // 2. For each required lab, get exercises and evaluations
            const progressData: LabProgress[] = [];

            for (let i = 0; i < requiredLabs.length; i++) {
                const lab = requiredLabs[i];

                const { allExercises, challengeExercises } = await this.fetchExercisesForLab(lab.id);
                const { challengeEvaluations, totalScore, evaluatedCount } = await this.fetchChallengeEvaluations(
                    lab.id,
                    challengeExercises
                );

                // Calculate statistics
                const stats = {
                    totalExercises: allExercises.length,
                    completedExercises: evaluatedCount,
                    averageScore: evaluatedCount > 0 ? totalScore / evaluatedCount : 0,
                };

                // Determine if lab is unlocked
                let isUnlocked = true;

                if (i > 0) {
                    // Check if all previous required labs are completed
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
     * Checks if a specific lab is blocked
     * @param pageId ID of the page/lab to check
     * @param courseId Course ID
     * @returns true if blocked, false if unlocked or not required
     */
    static async isLabBlocked(pageId: string, courseId: string): Promise<boolean> {
        try {
            // 1. Get lab list
            const labResponse = await chrome.runtime.sendMessage({
                action: "getLabData",
                courseId: courseId,
            });

            if (!labResponse?.success || !labResponse?.data?.labs) {
                return false; // No lab config, no blocking
            }

            const labList: Lab[] = labResponse.data.labs;

            // Find current lab
            const currentLab = labList.find(lab => lab.id === pageId);

            // If not a required lab, it is not blocked
            if (!currentLab?.required) {
                return false;
            }

            // Filter only required labs
            const requiredLabs = labList.filter(lab => lab.required);

            // Find index of current lab in required list
            const currentIndex = requiredLabs.findIndex(lab => lab.id === pageId);

            // If it is the first one, it is not blocked
            if (currentIndex <= 0) {
                return false;
            }

            // Load progress of all labs
            const { labs: progressData, requirements } = await this.loadProgressData(courseId);

            // Check if unlocked
            const isUnlocked = this.checkLabsUnlocked(requiredLabs, currentIndex, progressData, requirements);

            return !isUnlocked; // Blocked = NOT unlocked
        } catch (error) {
            console.error("[ProgressManager] Error checking lab blocked status:", error);
            return false; // In case of error, do not block
        }
    }
}
