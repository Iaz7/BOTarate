import React from "react";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isTiquismiqui?: boolean;
}

interface ExercisesTabProps {
    isLoadingExplanations: boolean;
    isLoadingEvaluations: boolean;
    exercises: Exercise[];
    exercisesWithExplanations: string[];
    exercisesWithEvaluations: string[];
    onExplanationClick: (exerciseName: string) => void;
    onEvaluationClick: (exerciseName: string) => void;
}

const ExercisesTab: React.FC<ExercisesTabProps> = ({
    isLoadingExplanations,
    isLoadingEvaluations,
    exercises,
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

    if (exercises.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>No exercises available</strong>
                <p className="mb-0 mt-2 small">
                    When exercises are detected on the page, they will appear here along with any saved explanations and
                    evaluations.
                </p>
            </div>
        );
    }

    return (
        <div className="list-group">
            {exercises.map((exercise, index) => {
                const hasExplanation = exercisesWithExplanations.includes(exercise.name);
                const hasEvaluation = exercisesWithEvaluations.includes(exercise.name);
                const isChallenge = exercise.allowed === false;
                const isPicky = exercise.isTiquismiqui === true;

                return (
                    <div
                        key={index}
                        className="list-group-item d-flex align-items-center"
                        style={{ minHeight: "56px" }}
                    >
                        <div className="d-flex w-100 justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                                <h6 className="mb-0">{exercise.name}</h6>
                                {isChallenge && <span className="badge bg-warning text-dark ms-2">Challenge</span>}
                                {isPicky && <span className="badge bg-info text-dark ms-2">Picky</span>}
                            </div>
                            <div className="d-flex gap-2">
                                {hasExplanation && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={() => onExplanationClick(exercise.name)}
                                    >
                                        <i className="bi bi-book me-1"></i>
                                        View explanation
                                    </button>
                                )}
                                {hasEvaluation && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-success"
                                        onClick={() => onEvaluationClick(exercise.name)}
                                    >
                                        <i className="bi bi-clipboard-check me-1"></i>
                                        View evaluations
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ExercisesTab;
