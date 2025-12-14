import type { Exercise } from "../../types/shared";
export type { ChatMessage, Exercise, Explanation, Step } from "../../types/shared";

export interface ExerciseModalProps {
    exercise: Exercise;
    isOpen: boolean;
    onClose: () => void;
    pageId?: string;
    courseId?: string;
    loadFromCache?: boolean; // Si es true, carga del cache. Si es false/undefined, genera nueva
    onExplanationGenerated?: () => void; // Callback cuando se genera una nueva explicación
}