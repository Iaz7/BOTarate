import React, { useEffect, useState } from "react";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
}

interface ExerciseConfigTabProps {
    exercises: Exercise[];
    pageId: string;
    onConfigUpdate?: () => void;
    isActive: boolean;
}

const ExerciseConfigTab: React.FC<ExerciseConfigTabProps> = ({ exercises, pageId, onConfigUpdate, isActive }) => {
    const [exerciseConfig, setExerciseConfig] = useState<Map<string, boolean>>(new Map());
    const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Cargar configuración inicial desde el storage cuando se activa la pestaña
    useEffect(() => {
        if (isActive && pageId) {
            loadConfigFromStorage();
        }
    }, [isActive, pageId]);

    const loadConfigFromStorage = async () => {
        try {
            // Obtener datos actualizados del storage
            const response = await chrome.runtime.sendMessage({
                action: "getExerciseData",
                pageId: pageId,
            });

            if (response.success && response.data) {
                const config = new Map<string, boolean>();
                for (const exercise of response.data.exercises) {
                    config.set(exercise.name, exercise.allowed ?? true);
                }
                setExerciseConfig(config);
                setPendingChanges(new Map());
                setHasUnsavedChanges(false);
            }
        } catch (error) {
            console.error("Error loading config from storage:", error);
            // Si falla, usar los ejercicios proporcionados
            loadConfigFromProps();
        }
    };

    const loadConfigFromProps = () => {
        const config = new Map<string, boolean>();
        for (const exercise of exercises) {
            config.set(exercise.name, exercise.allowed ?? true);
        }
        setExerciseConfig(config);
        setPendingChanges(new Map());
        setHasUnsavedChanges(false);
    };

    const handleToggle = (exerciseName: string) => {
        const currentValue = exerciseConfig.get(exerciseName) ?? true;
        const newValue = !currentValue;

        // Actualizar estado local
        setExerciseConfig(prev => {
            const newConfig = new Map(prev);
            newConfig.set(exerciseName, newValue);
            return newConfig;
        });

        // Marcar como cambio pendiente
        setPendingChanges(prev => {
            const newChanges = new Map(prev);
            newChanges.set(exerciseName, newValue);
            return newChanges;
        });

        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (pendingChanges.size === 0) return;

        setIsSaving(true);
        try {
            // Guardar todos los cambios
            for (const [exerciseName, allowed] of pendingChanges) {
                await chrome.runtime.sendMessage({
                    action: "updateExerciseAllowed",
                    pageId: pageId,
                    exerciseName: exerciseName,
                    allowed: allowed,
                });
            }

            // Eliminar explicaciones de ejercicios de reto
            const challengeExercises = Array.from(pendingChanges.entries())
                .filter(([_, allowed]) => !allowed)
                .map(([name]) => name);

            if (challengeExercises.length > 0) {
                await chrome.runtime.sendMessage({
                    action: "removeChallengeExercisesExplanations",
                    pageId: pageId,
                    exerciseNames: challengeExercises,
                });
            }

            // Limpiar cambios pendientes
            setPendingChanges(new Map());
            setHasUnsavedChanges(false);

            // Notificar al padre para regenerar el chat
            if (onConfigUpdate) {
                onConfigUpdate();
            }

            alert("Configuración guardada correctamente. El asistente se ha actualizado con la nueva configuración.");
        } catch (error) {
            console.error("Error saving exercise config:", error);
            alert("Error al guardar la configuración. Por favor, inténtalo de nuevo.");
        } finally {
            setIsSaving(false);
        }
    };

    if (exercises.length === 0) {
        return (
            <div className="alert alert-info" role="alert">
                <strong>No hay ejercicios disponibles</strong>
                <p className="mb-0 mt-2 small">
                    Cuando se detecten ejercicios en la página, podrás configurar cuáles son ejercicios de reto.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="alert alert-info small mb-3" role="alert">
                <strong>Configuración de ejercicios</strong>
                <p className="mb-0 mt-1">
                    Marca los ejercicios que son de reto. Los ejercicios de reto no podrán ser explicados ni resueltos
                    mediante la IA, pero sí evaluados cuando el estudiante envíe su solución.
                </p>
            </div>

            <div className="table-responsive">
                <table className="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th scope="col" style={{ width: "70%" }}>
                                Nombre del ejercicio
                            </th>
                            <th scope="col" className="text-center" style={{ width: "30%" }}>
                                Es reto
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {exercises.map(exercise => {
                            const isAllowed = exerciseConfig.get(exercise.name) ?? true;
                            const isChallenge = !isAllowed; // Invertir la lógica para mostrar
                            return (
                                <tr key={exercise.name}>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            <span>{exercise.name}</span>
                                            {isChallenge && (
                                                <span className="badge bg-warning text-dark ms-2">Reto</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="form-check form-switch d-inline-block">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id={`switch-${exercise.name}`}
                                                checked={isChallenge}
                                                onChange={() => handleToggle(exercise.name)}
                                                disabled={isSaving}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <label
                                                className="form-check-label visually-hidden"
                                                htmlFor={`switch-${exercise.name}`}
                                            >
                                                {isChallenge ? "Es reto" : "No es reto"}
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {hasUnsavedChanges && (
                <div className="alert alert-warning small mb-3" role="alert">
                    <strong>⚠️ Tienes cambios sin guardar</strong>
                    <p className="mb-0 mt-1">
                        Haz clic en "Guardar cambios" para aplicar la configuración y regenerar el asistente.
                    </p>
                </div>
            )}

            <div className="d-grid gap-2">
                <button
                    className="btn btn-primary"
                    onClick={handleSaveChanges}
                    disabled={isSaving || !hasUnsavedChanges}
                >
                    {isSaving ? (
                        <>
                            <output className="spinner-border spinner-border-sm me-2">
                                <span className="visually-hidden">Guardando...</span>
                            </output>
                            Guardando cambios...
                        </>
                    ) : (
                        "Guardar cambios"
                    )}
                </button>
            </div>

            {isSaving && (
                <div className="alert alert-secondary small d-flex align-items-center mt-2" role="alert">
                    <output className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">Guardando...</span>
                    </output>
                    Aplicando configuración y eliminando explicaciones de ejercicios de reto...
                </div>
            )}
        </div>
    );
};

export default ExerciseConfigTab;
