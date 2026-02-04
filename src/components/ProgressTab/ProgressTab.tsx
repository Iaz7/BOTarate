import React from "react";
import { useTranslation } from "react-i18next";
import { useProgressData } from "./hooks";
import {
    getBestScore,
    getLabBackgroundColor,
    getRequiredChallengesLabel,
    getScoreBadgeClass,
    isLabCompleted,
} from "./utils";

interface ProgressTabProps {
    courseId: string;
}

const ProgressTab: React.FC<ProgressTabProps> = ({ courseId }) => {
    const { t } = useTranslation();
    const { labProgress, isLoading, requirements } = useProgressData(courseId);

    // Función auxiliar para renderizar HTML seguro
    const renderHTML = (html: string) => <span dangerouslySetInnerHTML={{ __html: html }} />;

    if (isLoading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary">
                    <span className="visually-hidden">{t("progress.loading")}</span>
                </div>
                <p className="mt-3">{t("progress.loading")}</p>
            </div>
        );
    }

    if (labProgress.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>{t("progress.noLabsTitle")}</strong>
                <p className="mb-0 mt-2">{t("progress.noLabsDesc")}</p>
            </div>
        );
    }

    return (
        <div>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> {t("progress.infoTitle")}
                </h6>
                <p className="mb-2">{renderHTML(t("progress.infoDesc"))}</p>
                <ul className="mb-0 small">
                    <li>{renderHTML(t("progress.infoList.challenge"))}</li>
                    <li>{renderHTML(t("progress.infoList.score"))}</li>
                    <li>{renderHTML(t("progress.infoList.required"))}</li>
                </ul>
            </div>

            {requirements && (
                <div className="alert alert-secondary small mb-3" role="alert">
                    <strong>{t("progress.criteriaTitle")}</strong>
                    <ul className="mb-0 mt-2">
                        <li>{t("progress.minScore", { score: requirements.minScoreToPass.toFixed(1) })}</li>
                        <li>{t("progress.minPercentage", { percentage: requirements.minChallengesPercentage })}</li>
                    </ul>
                </div>
            )}

            {/* Lista de laboratorios */}
            <div className="list-group">
                {labProgress.map((progress, index) => (
                    <div
                        key={progress.lab.id}
                        className={`list-group-item ${getLabBackgroundColor(progress, requirements || undefined)}`}
                    >
                        <div className="d-flex w-100 justify-content-between align-items-start mb-2">
                            <h6 className="mb-1">
                                {!progress.isUnlocked && <i className="bi bi-lock-fill me-2"></i>}
                                {progress.isUnlocked && isLabCompleted(progress, requirements || undefined) && (
                                    <i className="bi bi-check-circle-fill me-2"></i>
                                )}
                                {t("progress.labCard.title", { index: index + 1, name: progress.lab.name })}
                            </h6>
                        </div>

                        {progress.isUnlocked ? (
                            <>
                                {/* Estadísticas generales */}
                                <div className="mb-2">
                                    <span className="badge bg-info me-2">
                                        {t("progress.labCard.exercises", {
                                            completed: progress.stats.completedExercises,
                                            total: progress.stats.totalExercises,
                                        })}
                                    </span>
                                    {progress.stats.completedExercises > 0 && (
                                        <span className="badge bg-primary">
                                            {t("progress.labCard.average", {
                                                score: progress.stats.averageScore.toFixed(1),
                                            })}
                                        </span>
                                    )}
                                </div>

                                {/* Lista de ejercicios de reto */}
                                {progress.challengeExercises.length > 0 && (
                                    <div className="mt-2">
                                        <small className="text-muted d-block mb-1">
                                            <strong>{t("progress.labCard.challengesTitle")}</strong>
                                        </small>
                                        {(() => {
                                            const requiredLabel = getRequiredChallengesLabel(
                                                progress,
                                                requirements || undefined,
                                            );
                                            return requiredLabel ? (
                                                <small className="text-muted d-block mb-2">{requiredLabel}</small>
                                            ) : null;
                                        })()}
                                        <div className="d-flex flex-wrap gap-2">
                                            {progress.challengeExercises.map(exercise => {
                                                const evaluations = progress.challengeEvaluations.get(exercise.name);
                                                const bestScore = getBestScore(evaluations);
                                                const badgeClass = getScoreBadgeClass(
                                                    bestScore,
                                                    requirements?.minScoreToPass ?? 5,
                                                );

                                                return (
                                                    <div
                                                        key={exercise.name}
                                                        className="d-flex align-items-center border rounded px-2 py-1 bg-white"
                                                        style={{ fontSize: "0.85rem" }}
                                                    >
                                                        <span className="me-2">{exercise.name}</span>
                                                        <span className={`badge ${badgeClass}`}>
                                                            {bestScore === null
                                                                ? t("progress.labCard.notAttempted")
                                                                : bestScore.toFixed(1)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {progress.challengeExercises.length === 0 && (
                                    <small className="text-muted">{t("progress.labCard.noChallenges")}</small>
                                )}
                            </>
                        ) : (
                            <p className="small mb-0">
                                <i className="bi bi-lock"></i> {t("progress.labCard.locked")}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProgressTab;
