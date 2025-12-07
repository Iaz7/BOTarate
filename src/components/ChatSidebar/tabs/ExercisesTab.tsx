import React from "react";

interface ExercisesTabProps {
    isLoadingExplanations: boolean;
    isLoadingEvaluations: boolean;
    exercisesWithExplanations: string[];
    exercisesWithEvaluations: string[];
    onExplanationClick: (exerciseName: string) => void;
    onEvaluationClick: (exerciseName: string) => void;
}

const ExercisesTab: React.FC<ExercisesTabProps> = ({
    isLoadingExplanations,
    isLoadingEvaluations,
    exercisesWithExplanations,
    exercisesWithEvaluations,
    onExplanationClick,
    onEvaluationClick,
}) => {
    if (isLoadingExplanations || isLoadingEvaluations) {
        return (
            <div className="card border-primary">
                <div className="card-body p-3">
                    <div className="d-flex align-items-center">
                        <div className="spinner-border spinner-border-sm text-primary me-2">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <span>Loading exercises...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (exercisesWithExplanations.length === 0 && exercisesWithEvaluations.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>No explanations or evaluations saved</strong>
                <p className="mb-0 mt-2 small">
                    Explanations and evaluations generated through the chat will be saved here so you can access them
                    later.
                </p>
            </div>
        );
    }

    return (
        <div className="list-group">
            {Array.from(new Set([...exercisesWithExplanations, ...exercisesWithEvaluations])).map(
                (exerciseName, index) => {
                    const hasExplanation = exercisesWithExplanations.includes(exerciseName);
                    const hasEvaluation = exercisesWithEvaluations.includes(exerciseName);

                    return (
                        <div key={index} className="list-group-item">
                            <div className="d-flex w-100 justify-content-between align-items-center">
                                <h6 className="mb-0">{exerciseName}</h6>
                                <div className="d-flex gap-2">
                                    {hasExplanation && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            onClick={() => onExplanationClick(exerciseName)}
                                        >
                                            <i className="bi bi-book me-1"></i>
                                            View explanation
                                        </button>
                                    )}
                                    {hasEvaluation && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-success"
                                            onClick={() => onEvaluationClick(exerciseName)}
                                        >
                                            <i className="bi bi-clipboard-check me-1"></i>
                                            View evaluations
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }
            )}
        </div>
    );
};

export default ExercisesTab;
