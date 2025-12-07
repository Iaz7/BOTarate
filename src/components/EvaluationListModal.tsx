import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BaseModal from "./BaseModal";

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

    const formatScore = (score: number) => {
        return score % 1 === 0 ? score.toString() : score.toFixed(1);
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={`Evaluaciones de ${exerciseName}`}>
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
                    <p className="mb-0 mt-2">Aún no has enviado soluciones para evaluación en este ejercicio.</p>
                </div>
            ) : (
                <div className="row" style={{ height: "85vh", minHeight: 400 }}>
                    {/* Lista de evaluaciones */}
                    <div className="col-md-4">
                        {/* Estadísticas */}
                        <div className="card mb-3">
                            <div className="card-body">
                                <h6 className="card-title">Estadísticas</h6>
                                <ul className="list-unstyled mb-0">
                                    <li>
                                        <strong>Mejor puntuación:</strong>{" "}
                                        {formatScore(Math.max(...evaluations.map(e => e.score)))}
                                    </li>
                                    <li>
                                        <strong>Puntuación media:</strong>{" "}
                                        {formatScore(
                                            evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
                                        )}
                                    </li>
                                    <li>
                                        <strong>Total intentos:</strong> {evaluations.length}
                                    </li>
                                </ul>
                            </div>
                        </div>

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
                                            <small className={selectedEvaluation === evaluation ? "" : "text-muted"}>
                                                {formatDate(evaluation.timestamp)}
                                            </small>
                                        </div>
                                        <span
                                            className={`badge bg-${getScoreColor(evaluation.score)}`}
                                            style={{ fontSize: "1rem" }}
                                        >
                                            {formatScore(evaluation.score)}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Detalles de la evaluación seleccionada */}
                    <div className="col-md-8 d-flex flex-column" style={{ height: "100%" }}>
                        {selectedEvaluation ? (
                            <>
                                <div className={`alert alert-${getScoreColor(selectedEvaluation.score)}`}>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h5 className="mb-0">
                                                Puntuación: {formatScore(selectedEvaluation.score)} / 10
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
                                        height: "20vh",
                                        overflowY: "auto",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    <code>{selectedEvaluation.solution}</code>
                                </pre>

                                <h6 className="mt-1">Feedback del evaluador:</h6>
                                <div
                                    className="border rounded p-3 flex-fill"
                                    style={{ height: "75vh", overflowY: "auto" }}
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
        </BaseModal>
    );
};

export default EvaluationListModal;
