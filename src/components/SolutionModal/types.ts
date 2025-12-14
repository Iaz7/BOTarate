import type { Exercise } from "../../types/shared";
export type { Evaluation, Exercise } from "../../types/shared";

export interface SolutionModalProps {
    exercise: Exercise;
    isOpen: boolean;
    onClose: () => void;
    exerciseContext?: string | null;
    concepts?: string[];
    learningObjectives?: string;
    pageId?: string;
    courseId?: string;
    onEvaluationGenerated?: () => void;
}