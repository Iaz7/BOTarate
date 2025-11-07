import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SavedEvaluation {
    exerciseName: string;
    solution: string;
    score: number;
    feedback: string;
    timestamp: number;
}

interface EvaluationListModalProps {
    exerciseName: string;
    isOpen: boolean;
    onClose: () => void;
    pageId?: string;
}

const EvaluationListModal: React.FC<EvaluationListModalProps> = ({ exerciseName, isOpen, onClose, pageId }) => {
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

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getScoreColor = (score: number) => {
        if (score >= 9) return "success";
        if (score >= 7) return "primary";
        if (score >= 5) return "warning";
        return "danger";
    };

    const getScoreLabel = (score: number) => {
        if (score >= 9) return "Excelente";
        if (score >= 7) return "Bien";
        if (score >= 5) return "Suficiente";
        return "Insuficiente";
    };

    if (!isOpen) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-xl modal-dialog-scrollable" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">
                            Evaluaciones de: <strong>{exerciseName}</strong>
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
                    </div>

                    <div className="modal-body">
                        {isLoading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Cargando evaluaciones...</span>
                                </div>
                                <p className="mt-3">Cargando evaluaciones...</p>
                            </div>
                        ) : evaluations.length === 0 ? (
                            <div className="alert alert-info">
                                <strong>No hay evaluaciones guardadas</strong>
                                <p className="mb-0 mt-2">
                                    Aún no has enviado soluciones para evaluación en este ejercicio.
                                </p>
                            </div>
                        ) : (
                            <div className="row">
                                {/* Lista de evaluaciones */}
                                <div className="col-md-4">
                                    <h6 className="mb-3">Historial de intentos ({evaluations.length})</h6>
                                    <div className="list-group">
                                        {evaluations.map((evaluation, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                className={`list-group-item list-group-item-action ${
                                                    selectedEvaluation === evaluation ? "active" : ""
                                                }`}
                                                onClick={() => setSelectedEvaluation(evaluation)}
                                            >
                                                <div className="d-flex w-100 justify-content-between align-items-center">
                                                    <div>
                                                        <h6 className="mb-1">Intento #{evaluations.length - index}</h6>
                                                        <small
                                                            className={
                                                                selectedEvaluation === evaluation ? "" : "text-muted"
                                                            }
                                                        >
                                                            {formatDate(evaluation.timestamp)}
                                                        </small>
                                                    </div>
                                                    <span
                                                        className={`badge bg-${getScoreColor(evaluation.score)}`}
                                                        style={{ fontSize: "1rem" }}
                                                    >
                                                        {evaluation.score.toFixed(1)}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Estadísticas */}
                                    <div className="card mt-3">
                                        <div className="card-body">
                                            <h6 className="card-title">Estadísticas</h6>
                                            <ul className="list-unstyled mb-0">
                                                <li>
                                                    <strong>Mejor puntuación:</strong>{" "}
                                                    {Math.max(...evaluations.map(e => e.score)).toFixed(1)}
                                                </li>
                                                <li>
                                                    <strong>Puntuación media:</strong>{" "}
                                                    {(
                                                        evaluations.reduce((sum, e) => sum + e.score, 0) /
                                                        evaluations.length
                                                    ).toFixed(1)}
                                                </li>
                                                <li>
                                                    <strong>Total intentos:</strong> {evaluations.length}
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Detalles de la evaluación seleccionada */}
                                <div className="col-md-8">
                                    {selectedEvaluation ? (
                                        <>
                                            <div className={`alert alert-${getScoreColor(selectedEvaluation.score)}`}>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <h5 className="mb-0">
                                                            Puntuación: {selectedEvaluation.score.toFixed(1)} / 10
                                                        </h5>
                                                        <small>
                                                            {getScoreLabel(selectedEvaluation.score)} -{" "}
                                                            {formatDate(selectedEvaluation.timestamp)}
                                                        </small>
                                                    </div>
                                                </div>
                                            </div>

                                            <h6>Tu solución:</h6>
                                            <pre
                                                className="bg-light p-3 rounded"
                                                style={{
                                                    maxHeight: "200px",
                                                    overflowY: "auto",
                                                    fontSize: "0.9rem",
                                                }}
                                            >
                                                <code>{selectedEvaluation.solution}</code>
                                            </pre>

                                            <h6 className="mt-4">Feedback del evaluador:</h6>
                                            <div
                                                className="border rounded p-3"
                                                style={{
                                                    maxHeight: "400px",
                                                    overflowY: "auto",
                                                }}
                                            >
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {selectedEvaluation.feedback}
                                                </ReactMarkdown>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="alert alert-info">
                                            Selecciona una evaluación del historial para ver los detalles.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvaluationListModal;
