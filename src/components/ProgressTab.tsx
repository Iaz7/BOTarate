import React, { useEffect, useState } from "react";
import { LabProgress, ProgressManager, SavedEvaluation } from "../util/progress/ProgressManager";

interface ProgressTabProps {
    courseId: string;
}

const ProgressTab: React.FC<ProgressTabProps> = ({ courseId }) => {
    const [labProgress, setLabProgress] = useState<LabProgress[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        loadProgressData();
    }, [courseId]);

    const loadProgressData = async () => {
        setIsLoading(true);
        try {
            const progressData = await ProgressManager.loadProgressData(courseId);
            setLabProgress(progressData);
        } catch (error) {
            console.error("[ProgressTab] Error loading progress data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const isLabCompleted = (progress: LabProgress): boolean => {
        return ProgressManager.isLabCompleted(progress);
    };

    const getLabBackgroundColor = (progress: LabProgress): string => {
        if (!progress.isUnlocked) {
            return "list-group-item-danger"; // Rojo para bloqueados
        }

        if (isLabCompleted(progress)) {
            return "list-group-item-success"; // Verde para completados
        }

        return "list-group-item-warning"; // Amarillo para en progreso
    };

    const getBestScore = (evaluations: SavedEvaluation[] | undefined): number | null => {
        if (!evaluations || evaluations.length === 0) return null;
        return Math.max(...evaluations.map(e => e.score));
    };

    const getScoreBadgeClass = (score: number | null): string => {
        if (score === null) return "bg-secondary";
        if (score >= 5) return "bg-success";
        return "bg-danger";
    };

    if (isLoading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary">
                    <span className="visually-hidden">Cargando progreso...</span>
                </div>
                <p className="mt-3">Cargando progreso...</p>
            </div>
        );
    }

    if (labProgress.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>No hay laboratorios configurados</strong>
                <p className="mb-0 mt-2">
                    El profesor aún no ha configurado el sistema de laboratorios y progresión para este curso.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> Sistema de Progresión
                </h6>
                <p className="mb-2">
                    Los laboratorios se desbloquean secuencialmente. Para acceder a un laboratorio, debes completar
                    todos los <strong>ejercicios de reto</strong> del laboratorio anterior con una nota mínima de{" "}
                    <strong>5.0</strong>.
                </p>
                <ul className="mb-0 small">
                    <li>
                        <strong>Ejercicios de reto:</strong> No pueden ser explicados por la IA, pero sí evaluados
                        cuando envíes tu solución.
                    </li>
                    <li>
                        <strong>Nota registrada:</strong> Se guarda tu mejor puntuación en cada ejercicio.
                    </li>
                    <li>
                        <strong>Solo laboratorios requeridos:</strong> Esta vista muestra únicamente los laboratorios
                        marcados como requeridos por el profesor, que deben completarse en orden para avanzar.
                    </li>
                </ul>
            </div>

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
                                        Ejercicios: {progress.stats.completedExercises} /{" "}
                                        {progress.stats.totalExercises}
                                    </span>
                                    {progress.stats.completedExercises > 0 && (
                                        <span className="badge bg-primary">
                                            Nota media: {progress.stats.averageScore.toFixed(1)}
                                        </span>
                                    )}
                                </div>

                                {/* Lista de ejercicios de reto */}
                                {progress.challengeExercises.length > 0 && (
                                    <div className="mt-2">
                                        <small className="text-muted d-block mb-1">
                                            <strong>Ejercicios de reto:</strong>
                                        </small>
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
                                                            {bestScore === null ? "No realizado" : bestScore.toFixed(1)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {progress.challengeExercises.length === 0 && (
                                    <small className="text-muted">No hay ejercicios de reto en este laboratorio.</small>
                                )}
                            </>
                        ) : (
                            <p className="small mb-0">
                                <i className="bi bi-lock"></i> Laboratorio bloqueado. Completa el laboratorio anterior.
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProgressTab;
