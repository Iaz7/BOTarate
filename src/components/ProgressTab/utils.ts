import {
    LabProgress,
    ProgressManager,
    ProgressRequirements,
    SavedEvaluation,
} from "../../util/progress/ProgressManager";

export const isLabCompleted = (progress: LabProgress, requirements?: ProgressRequirements): boolean => {
    return ProgressManager.isLabCompleted(progress, requirements);
};

export const getLabBackgroundColor = (progress: LabProgress, requirements?: ProgressRequirements): string => {
    if (!progress.isUnlocked) {
        return "list-group-item-danger"; // Red for locked
    }

    if (isLabCompleted(progress, requirements)) {
        return "list-group-item-success"; // Green for completed
    }

    return "list-group-item-warning"; // Yellow for in progress
};

export const getBestScore = (evaluations: SavedEvaluation[] | undefined): number | null => {
    if (!evaluations || evaluations.length === 0) return null;
    return Math.max(...evaluations.map(e => e.score));
};

export const getScoreBadgeClass = (score: number | null, minScore: number): string => {
    if (score === null) return "bg-secondary";
    if (score >= minScore) return "bg-success";
    return "bg-danger";
};

export const getRequiredChallengesLabel = (progress: LabProgress, requirements?: ProgressRequirements): string | null => {
    if (!requirements || progress.challengeExercises.length === 0) {
        return null;
    }

    const required = Math.min(
        progress.challengeExercises.length,
        Math.ceil((requirements.minChallengesPercentage / 100) * progress.challengeExercises.length)
    );

    if (required === 0) {
        return null;
    }

    return `You need to pass ${required} of ${progress.challengeExercises.length} challenges.`;
};