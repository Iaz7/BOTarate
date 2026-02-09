export interface LabContextModalProps {
    isOpen: boolean;
    onClose: () => void;
    labId: string;
    labName: string;
    onContextUpdate?: () => void;
}

export interface LabContextData {
    learningObjectives: string;
    exerciseContext: string;
    concepts: string[];
}