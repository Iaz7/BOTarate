export interface ProgressConfigTabProps {
    isActive: boolean;
    courseId?: string;
}

export interface ProgressConfigForm {
    minScoreToPass: number;
    minChallengesPercentage: number;
}

export type StatusMessage = {
    type: "success" | "error";
    text: string;
} | null;