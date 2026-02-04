import React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import BaseModal from "../BaseModal";
import { useSolutionModal } from "./hooks";
import { SolutionModalProps } from "./types";
import { getScoreColor, getScoreLabel } from "./utils";

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
    const { t } = useTranslation();
    const { solution, setSolution, evaluation, isEvaluating, evaluationError, handleSubmit } = useSolutionModal(
        isOpen,
        exercise.name,
        onEvaluationGenerated,
    );

    if (!isOpen) return null;

    const onSubmit = () =>
        handleSubmit(
            exercise.name,
            exercise.statement,
            exerciseContext || undefined,
            learningObjectives || undefined,
            pageId || undefined,
            courseId || undefined,
        );

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={t("exercises.solve", { name: exercise.name })}>
            {/* Enunciado del ejercicio */}
            <div className="mb-4">
                <h6 className="text-primary">{t("exercises.statement")}:</h6>
                <div className="border rounded p-3 bg-light">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{exercise.statement}</ReactMarkdown>
                </div>
            </div>

            {/* Campo de entrada de solución */}
            {!evaluation && (
                <div className="mb-4">
                    <label htmlFor="solution-input" className="form-label">
                        <strong>{t("exercises.yourSolution")}:</strong>
                    </label>
                    <textarea
                        id="solution-input"
                        className="form-control font-monospace"
                        rows={10}
                        value={solution}
                        onChange={e => setSolution(e.target.value)}
                        placeholder={t("exercises.placeholderSQL")}
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
                        <span className="visually-hidden">{t("evaluation.evaluating")}</span>
                    </output>
                    <p className="text-muted">{t("evaluation.evaluating")}</p>
                </div>
            )}

            {/* Evaluación */}
            {evaluation && !isEvaluating && (
                <div>
                    {/* Puntuación */}
                    <div
                        className={`alert alert-${getScoreColor(
                            evaluation.score,
                        )} d-flex align-items-center justify-content-between`}
                    >
                        <div>
                            <h5 className="mb-0">
                                <strong>
                                    {t("evaluation.score")}: {evaluation.score}/10
                                </strong>
                                <span className="ms-2">({t(getScoreLabel(evaluation.score))})</span>
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
                        <h6 className="text-primary">{t("evaluation.feedback")}:</h6>
                        <div className="border rounded p-3 bg-light">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{evaluation.feedback}</ReactMarkdown>
                        </div>
                    </div>

                    {/* Botón para intentar de nuevo */}
                    <div className="alert alert-info" role="alert">
                        <strong>{t("evaluation.retry.title")}</strong>
                        <p className="mb-2 mt-1 small">{t("evaluation.retry.desc")}</p>
                    </div>
                </div>
            )}

            {/* Botones */}
            {!evaluation && (
                <div className="d-flex justify-content-end gap-2 mt-4">
                    <button className="btn btn-secondary" onClick={onClose} disabled={isEvaluating}>
                        {t("common.cancel")}
                    </button>
                    <button className="btn btn-primary" onClick={onSubmit} disabled={isEvaluating || !solution.trim()}>
                        {isEvaluating ? (
                            <>
                                <output className="spinner-border spinner-border-sm me-2">
                                    <span className="visually-hidden">{t("common.loading")}</span>
                                </output>
                                {t("evaluation.evaluating")}
                            </>
                        ) : (
                            t("exercises.submitSolution")
                        )}
                    </button>
                </div>
            )}
        </BaseModal>
    );
};

export default SolutionModal;
