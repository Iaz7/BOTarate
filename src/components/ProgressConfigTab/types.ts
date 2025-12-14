export interface ProgressConfigTabProps {
    isActive: boolean;
}

export interface ProgressConfigForm {
    minScoreToPass: number;
    minChallengesPercentage: number;
}

export type StatusMessage = {
    type: "success" | "error";
    text: string;
} | null;