import { useEffect, useState } from "react";
import { SavedEvaluation } from "./types";

export const useEvaluations = (isOpen: boolean, exerciseName: string, pageId?: string) => {
    const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedEvaluation, setSelectedEvaluation] = useState<SavedEvaluation | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadEvaluations();
        }
    }, [isOpen, exerciseName]);

    const loadEvaluations = async () => {
        setIsLoading(true);
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getEvaluations",
                exerciseName: exerciseName,
                pageId: pageId,
            });

            if (response.success && response.evaluations) {
                setEvaluations(response.evaluations);
                // Seleccionar la evaluación más reciente por defecto
                if (response.evaluations.length > 0) {
                    setSelectedEvaluation(response.evaluations[0]);
                }
            }
        } catch (error) {
            console.error("[EvaluationListModal] Error loading evaluations:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        evaluations,
        isLoading,
        selectedEvaluation,
        setSelectedEvaluation,
    };
};