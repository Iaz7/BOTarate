import React, { useEffect, useState } from "react";
import { LabProgress, ProgressManager, ProgressRequirements, SavedEvaluation } from "../util/progress/ProgressManager";

interface ProgressTabProps {
    courseId: string;
}

const ProgressTab: React.FC<ProgressTabProps> = ({ courseId }) => {
    const [labProgress, setLabProgress] = useState<LabProgress[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [requirements, setRequirements] = useState<ProgressRequirements | null>(null);

    useEffect(() => {
        loadProgressData();
    }, [courseId]);

    const loadProgressData = async () => {
        setIsLoading(true);
        try {
            const progressData = await ProgressManager.loadProgressData(courseId);
            setLabProgress(progressData.labs);
            setRequirements(progressData.requirements);
        } catch (error) {
            console.error("[ProgressTab] Error loading progress data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const isLabCompleted = (progress: LabProgress): boolean => {
        return ProgressManager.isLabCompleted(progress, requirements || undefined);
    };

    const getLabBackgroundColor = (progress: LabProgress): string => {
        if (!progress.isUnlocked) {
            return "list-group-item-danger"; // Red for locked
        }

        if (isLabCompleted(progress)) {
            return "list-group-item-success"; // Green for completed
        }

        return "list-group-item-warning"; // Yellow for in progress
    };

    const getBestScore = (evaluations: SavedEvaluation[] | undefined): number | null => {
        if (!evaluations || evaluations.length === 0) return null;
        return Math.max(...evaluations.map(e => e.score));
    };

    const getScoreBadgeClass = (score: number | null): string => {
        if (score === null) return "bg-secondary";
        const minScore = requirements?.minScoreToPass ?? 5;
        if (score >= minScore) return "bg-success";
        return "bg-danger";
    };

    const getRequiredChallengesLabel = (progress: LabProgress): string | null => {
        if (!requirements || progress.challengeExercises.length === 0) {
            return null;
        }

        const required = Math.min(
            progress.challengeExercises.length,
            Math.ceil((requirements.minChallengesPercentage / 100) * progress.challengeExercises.length)
        );

        if (required === 0) {
            return null;
        }

        return `You need to pass ${required} of ${progress.challengeExercises.length} challenges.`;
    };

    if (isLoading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary">
                    <span className="visually-hidden">Loading progress...</span>
                </div>
                <p className="mt-3">Loading progress...</p>
            </div>
        );
    }

    if (labProgress.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>No labs configured</strong>
                <p className="mb-0 mt-2">
                    The teacher has not yet configured the lab and progression system for this course.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> Progression system
                </h6>
                <p className="mb-2">
                    Labs unlock sequentially. To access a lab, you must complete the{" "}
                    <strong>challenge exercises</strong> of the previous lab following the criteria defined by your
                    teacher.
                </p>
                <ul className="mb-0 small">
                    <li>
                        <strong>Challenge exercises:</strong> Cannot be explained by AI, but can be evaluated when you
                        submit your solution.
                    </li>
                    <li>
                        <strong>Recorded score:</strong> Your best score for each exercise is saved.
                    </li>
                    <li>
                        <strong>Required labs only:</strong> This view shows only the labs marked as required by the
                        teacher, which must be completed in order to advance.
                    </li>
                </ul>
            </div>

            {requirements && (
                <div className="alert alert-secondary small mb-3" role="alert">
                    <strong>Current criteria:</strong>
                    <ul className="mb-0 mt-2">
                        <li>Minimum score per challenge: {requirements.minScoreToPass.toFixed(1)} / 10</li>
                        <li>
                            Minimum percentage of passed challenges: {requirements.minChallengesPercentage}% of the
                            total challenges in the lab
                        </li>
                    </ul>
                </div>
            )}

            {/* Lista de laboratorios */}
            <div className="list-group">
                {labProgress.map((progress, index) => (
                    <div key={progress.lab.id} className={`list-group-item ${getLabBackgroundColor(progress)}`}>
                        <div className="d-flex w-100 justify-content-between align-items-start mb-2">
                            <h6 className="mb-1">
                                {!progress.isUnlocked && <i className="bi bi-lock-fill me-2"></i>}
                                {progress.isUnlocked && isLabCompleted(progress) && (
                                    <i className="bi bi-check-circle-fill me-2"></i>
                                )}
                                Lab {index + 1}: {progress.lab.name}
                            </h6>
                        </div>

                        {progress.isUnlocked ? (
                            <>
                                {/* Estadísticas generales */}
                                <div className="mb-2">
                                    <span className="badge bg-info me-2">
                                        Exercises: {progress.stats.completedExercises} / {progress.stats.totalExercises}
                                    </span>
                                    {progress.stats.completedExercises > 0 && (
                                        <span className="badge bg-primary">
                                            Average score: {progress.stats.averageScore.toFixed(1)}
                                        </span>
                                    )}
                                </div>

                                {/* Lista de ejercicios de reto */}
                                {progress.challengeExercises.length > 0 && (
                                    <div className="mt-2">
                                        <small className="text-muted d-block mb-1">
                                            <strong>Challenge exercises:</strong>
                                        </small>
                                        {(() => {
                                            const requiredLabel = getRequiredChallengesLabel(progress);
                                            return requiredLabel ? (
                                                <small className="text-muted d-block mb-2">{requiredLabel}</small>
                                            ) : null;
                                        })()}
                                        <div className="d-flex flex-wrap gap-2">
                                            {progress.challengeExercises.map(exercise => {
                                                const evaluations = progress.challengeEvaluations.get(exercise.name);
                                                const bestScore = getBestScore(evaluations);
                                                const badgeClass = getScoreBadgeClass(bestScore);

                                                return (
                                                    <div
                                                        key={exercise.name}
                                                        className="d-flex align-items-center border rounded px-2 py-1 bg-white"
                                                        style={{ fontSize: "0.85rem" }}
                                                    >
                                                        <span className="me-2">{exercise.name}</span>
                                                        <span className={`badge ${badgeClass}`}>
                                                            {bestScore === null
                                                                ? "Not attempted"
                                                                : bestScore.toFixed(1)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {progress.challengeExercises.length === 0 && (
                                    <small className="text-muted">There are no challenge exercises in this lab.</small>
                                )}
                            </>
                        ) : (
                            <p className="small mb-0">
                                <i className="bi bi-lock"></i> Lab locked. Complete the previous lab following the
                                configured criteria.
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProgressTab;
