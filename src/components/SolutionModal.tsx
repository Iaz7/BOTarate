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
            setEvaluationError("Por favor, introduce una solución antes de enviar");
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
                concepts: concepts || undefined,
                learning_objectives: learningObjectives || undefined,
                pageId: pageId || undefined,
            });

            if (response.success) {
                setEvaluation(response.evaluation);
                console.log("Solución evaluada exitosamente");
                // Notificar que se generó una nueva evaluación
                if (onEvaluationGenerated) {
                    onEvaluationGenerated();
                }
            } else {
                const errorMessage = response.error || "Error desconocido al evaluar la solución";
                console.error("Error al evaluar solución:", errorMessage);
                setEvaluationError(errorMessage);
            }
        } catch (error) {
            console.error("Error al evaluar solución:", error);
            const errorMessage =
                error instanceof Error
                    ? `Error de comunicación: ${error.message}`
                    : "Error de comunicación con el asistente de IA";
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
        if (score >= 9) return "Excelente";
        if (score >= 7) return "Buena";
        if (score >= 5) return "Aceptable";
        if (score >= 3) return "Insuficiente";
        return "Muy deficiente";
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={`Resolver Ejercicio: ${exercise.name}`}>
            {/* Enunciado del ejercicio */}
            <div className="mb-4">
                <h6 className="text-primary">Enunciado:</h6>
                <div className="border rounded p-3 bg-light">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{exercise.statement}</ReactMarkdown>
                </div>
            </div>

            {/* Campo de entrada de solución */}
            {!evaluation && (
                <div className="mb-4">
                    <label htmlFor="solution-input" className="form-label">
                        <strong>Tu solución SQL:</strong>
                    </label>
                    <textarea
                        id="solution-input"
                        className="form-control font-monospace"
                        rows={10}
                        value={solution}
                        onChange={e => setSolution(e.target.value)}
                        placeholder="Escribe aquí tu consulta SQL..."
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
                        <span className="visually-hidden">Evaluando...</span>
                    </output>
                    <p className="text-muted">Evaluando tu solución...</p>
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
                                <strong>Puntuación: {evaluation.score}/10</strong>
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
                        <strong>¿Quieres intentarlo de nuevo?</strong>
                        <p className="mb-2 mt-1 small">
                            Puedes cerrar este modal y volver a solicitar resolver el ejercicio para enviar una nueva
                            solución.
                        </p>
                    </div>
                </div>
            )}

            {/* Botones */}
            {!evaluation && (
                <div className="d-flex justify-content-end gap-2 mt-4">
                    <button className="btn btn-secondary" onClick={onClose} disabled={isEvaluating}>
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={isEvaluating || !solution.trim()}
                    >
                        {isEvaluating ? (
                            <>
                                <output className="spinner-border spinner-border-sm me-2">
                                    <span className="visually-hidden">Evaluando...</span>
                                </output>
                                Evaluando...
                            </>
                        ) : (
                            "Enviar solución"
                        )}
                    </button>
                </div>
            )}
        </BaseModal>
    );
};

export default SolutionModal;
