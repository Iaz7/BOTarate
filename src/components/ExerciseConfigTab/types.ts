import type { Exercise } from "../../types/shared";
export type { Exercise } from "../../types/shared";

export interface ExerciseFlags {
    allowed: boolean;
    isTiquismiqui: boolean;
}

export interface ExerciseConfigTabProps {
    exercises: Exercise[];
    pageId: string;
    onConfigUpdate?: () => void;
    isActive: boolean;
}