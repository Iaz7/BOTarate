import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BaseModal from "./BaseModal";

interface Exercise {
    name: string;
    statement: string;
    isTiquismiqui?: boolean;
}

interface Evaluation {
    score: number;
    feedback: string;
}

interface SolutionModalProps {
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

const SolutionModal: React.FC<SolutionModalProps> = ({
    exercise,
    isOpen,
    onClose,
    exerciseContext,
    concepts,
    learningObjectives,
    pageId,
    courseId,
    onEvaluationGenerated,
}) => {
    const [solution, setSolution] = useState<string>("");
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
    const [evaluationError, setEvaluationError] = useState<string | null>(null);

    // Resetear el estado al abrir el modal
    React.useEffect(() => {
        if (isOpen) {
            setSolution("");
            setEvaluation(null);
            setEvaluationError(null);
        }
    }, [isOpen, exercise.name]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!solution.trim()) {
            setEvaluationError("Please enter a solution before submitting");
            return;
        }

        setIsEvaluating(true);
        setEvaluationError(null);
        setEvaluation(null);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "evaluateSolution",
                exerciseName: exercise.name,
                exerciseStatement: exercise.statement,
                studentSolution: solution,
                exercise_context: exerciseContext || undefined,
                learning_objectives: learningObjectives || undefined,
                pageId: pageId || undefined,
                courseId: courseId || undefined,
            });

            if (response.success) {
                setEvaluation(response.evaluation);
                console.log("Solution evaluated successfully");
                // Notificar que se generó una nueva evaluación
                if (onEvaluationGenerated) {
                    onEvaluationGenerated();
                }
            } else {
                const errorMessage = response.error || "Unknown error evaluating solution";
                console.error("Error evaluating solution:", errorMessage);
                setEvaluationError(errorMessage);
            }
        } catch (error) {
            console.error("Error evaluating solution:", error);
            const errorMessage =
                error instanceof Error
                    ? `Communication error: ${error.message}`
                    : "Communication error with AI assistant";
            setEvaluationError(errorMessage);
        } finally {
            setIsEvaluating(false);
        }
    };

    const getScoreColor = (score: number): string => {
        if (score >= 9) return "success";
        if (score >= 7) return "primary";
        if (score >= 5) return "warning";
        return "danger";
    };

    const getScoreLabel = (score: number): string => {
        if (score >= 9) return "Excellent";
        if (score >= 7) return "Good";
        if (score >= 5) return "Acceptable";
        if (score >= 3) return "Insufficient";
        return "Very poor";
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={`Solve exercise: ${exercise.name}`}>
            {/* Enunciado del ejercicio */}
            <div className="mb-4">
                <h6 className="text-primary">Statement:</h6>
                <div className="border rounded p-3 bg-light">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{exercise.statement}</ReactMarkdown>
                </div>
            </div>

            {/* Campo de entrada de solución */}
            {!evaluation && (
                <div className="mb-4">
                    <label htmlFor="solution-input" className="form-label">
                        <strong>Your SQL solution:</strong>
                    </label>
                    <textarea
                        id="solution-input"
                        className="form-control font-monospace"
                        rows={10}
                        value={solution}
                        onChange={e => setSolution(e.target.value)}
                        placeholder="Write your SQL query here..."
                        disabled={isEvaluating}
                        style={{ fontSize: "0.9rem" }}
                    />
                    {evaluationError && (
                        <div className="alert alert-danger mt-2 mb-0" role="alert">
                            {evaluationError}
                        </div>
                    )}
                </div>
            )}

            {/* Indicador de carga */}
            {isEvaluating && (
                <div className="text-center py-4">
                    <output className="spinner-border text-primary mb-3">
                        <span className="visually-hidden">Evaluating...</span>
                    </output>
                    <p className="text-muted">Evaluating your solution...</p>
                </div>
            )}

            {/* Evaluación */}
            {evaluation && !isEvaluating && (
                <div>
                    {/* Puntuación */}
                    <div
                        className={`alert alert-${getScoreColor(
                            evaluation.score
                        )} d-flex align-items-center justify-content-between`}
                    >
                        <div>
                            <h5 className="mb-0">
                                <strong>Score: {evaluation.score}/10</strong>
                                <span className="ms-2">({getScoreLabel(evaluation.score)})</span>
                            </h5>
                        </div>
                        <div>
                            <span className="badge bg-dark" style={{ fontSize: "1.5rem" }}>
                                {evaluation.score}/10
                            </span>
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="mb-3">
                        <h6 className="text-primary">Feedback:</h6>
                        <div className="border rounded p-3 bg-light">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{evaluation.feedback}</ReactMarkdown>
                        </div>
                    </div>

                    {/* Botón para intentar de nuevo */}
                    <div className="alert alert-info" role="alert">
                        <strong>Do you want to try again?</strong>
                        <p className="mb-2 mt-1 small">
                            You can close this modal and request to solve the exercise again to submit a new solution.
                        </p>
                    </div>
                </div>
            )}

            {/* Botones */}
            {!evaluation && (
                <div className="d-flex justify-content-end gap-2 mt-4">
                    <button className="btn btn-secondary" onClick={onClose} disabled={isEvaluating}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={isEvaluating || !solution.trim()}
                    >
                        {isEvaluating ? (
                            <>
                                <output className="spinner-border spinner-border-sm me-2">
                                    <span className="visually-hidden">Evaluating...</span>
                                </output>
                                Evaluating...
                            </>
                        ) : (
                            "Submit solution"
                        )}
                    </button>
                </div>
            )}
        </BaseModal>
    );
};

export default SolutionModal;
