import React, { useEffect, useState } from "react";

interface Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isTiquismiqui?: boolean;
}

interface ExerciseFlags {
    allowed: boolean;
    isTiquismiqui: boolean;
}

interface ExerciseConfigTabProps {
    exercises: Exercise[];
    pageId: string;
    onConfigUpdate?: () => void;
    isActive: boolean;
    isLoadingExercises?: boolean;
    onIdentifyExercises?: () => void;
}

const ExerciseConfigTab: React.FC<ExerciseConfigTabProps> = ({
    exercises,
    pageId,
    onConfigUpdate,
    isActive,
    isLoadingExercises = false,
    onIdentifyExercises,
}) => {
    const [exerciseConfig, setExerciseConfig] = useState<Map<string, ExerciseFlags>>(new Map());
    const [originalConfig, setOriginalConfig] = useState<Map<string, ExerciseFlags>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const getDefaultFlags = (): ExerciseFlags => ({ allowed: true, isTiquismiqui: false });

    const createFlagsFromExercise = (exercise: Exercise): ExerciseFlags => ({
        allowed: exercise.allowed ?? true,
        isTiquismiqui: exercise.isTiquismiqui ?? false,
    });

    const buildConfigMap = (list: Exercise[]): Map<string, ExerciseFlags> => {
        const config = new Map<string, ExerciseFlags>();
        for (const exercise of list) {
            config.set(exercise.name, createFlagsFromExercise(exercise));
        }
        return config;
    };

    const configsAreEqual = (a: Map<string, ExerciseFlags>, b: Map<string, ExerciseFlags>): boolean => {
        if (a.size !== b.size) return false;
        for (const [name, flags] of a) {
            const reference = b.get(name);
            if (!reference) return false;
            if (flags.allowed !== reference.allowed || flags.isTiquismiqui !== reference.isTiquismiqui) {
                return false;
            }
        }
        return true;
    };

    React.useEffect(() => {
        setHasUnsavedChanges(!configsAreEqual(exerciseConfig, originalConfig));
    }, [exerciseConfig, originalConfig]);

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
                const config = buildConfigMap(response.data.exercises);
                setExerciseConfig(config);
                setOriginalConfig(new Map(config));
                setHasUnsavedChanges(false);
            }
        } catch (error) {
            console.error("Error loading config from storage:", error);
            // Si falla, usar los ejercicios proporcionados
            loadConfigFromProps();
        }
    };

    const loadConfigFromProps = () => {
        const config = buildConfigMap(exercises);
        setExerciseConfig(config);
        setOriginalConfig(new Map(config));
        setHasUnsavedChanges(false);
    };

    const updateExerciseFlags = (exerciseName: string, updater: (flags: ExerciseFlags) => ExerciseFlags) => {
        setExerciseConfig(prev => {
            const current = prev.get(exerciseName) ?? getDefaultFlags();
            const updated = updater(current);
            const newConfig = new Map(prev);
            newConfig.set(exerciseName, updated);
            return newConfig;
        });
    };

    const handleToggleChallenge = (exerciseName: string) => {
        updateExerciseFlags(exerciseName, flags => ({ ...flags, allowed: !flags.allowed }));
    };

    const handleToggleTiquismiqui = (exerciseName: string) => {
        updateExerciseFlags(exerciseName, flags => ({ ...flags, isTiquismiqui: !flags.isTiquismiqui }));
    };

    const computePendingChanges = () => {
        const changes: Array<{ name: string; allowed?: boolean; isTiquismiqui?: boolean }> = [];
        for (const [name, flags] of exerciseConfig.entries()) {
            const originalFlags = originalConfig.get(name) ?? getDefaultFlags();
            const change: { name: string; allowed?: boolean; isTiquismiqui?: boolean } = { name };

            if (flags.allowed !== originalFlags.allowed) {
                change.allowed = flags.allowed;
            }
            if (flags.isTiquismiqui !== originalFlags.isTiquismiqui) {
                change.isTiquismiqui = flags.isTiquismiqui;
            }

            if (change.allowed !== undefined || change.isTiquismiqui !== undefined) {
                changes.push(change);
            }
        }
        return changes;
    };

    const handleSaveChanges = async () => {
        const changes = computePendingChanges();
        if (changes.length === 0) return;

        setIsSaving(true);
        try {
            // Guardar todos los cambios
            for (const change of changes) {
                if (change.allowed !== undefined) {
                    await chrome.runtime.sendMessage({
                        action: "updateExerciseAllowed",
                        pageId: pageId,
                        exerciseName: change.name,
                        allowed: change.allowed,
                    });
                }

                if (change.isTiquismiqui !== undefined) {
                    await chrome.runtime.sendMessage({
                        action: "updateExerciseTiquismiqui",
                        pageId: pageId,
                        exerciseName: change.name,
                        isTiquismiqui: change.isTiquismiqui,
                    });
                }
            }

            const challengeExercises = changes.filter(change => change.allowed === false).map(change => change.name);

            if (challengeExercises.length > 0) {
                await chrome.runtime.sendMessage({
                    action: "removeChallengeExercisesExplanations",
                    pageId: pageId,
                    exerciseNames: challengeExercises,
                });
            }

            setOriginalConfig(new Map(exerciseConfig));
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
            <div>
                {/* Explicación del sistema */}
                <div className="alert alert-primary small mb-3" role="alert">
                    <h6 className="alert-heading">
                        <i className="bi bi-info-circle"></i> Configuración de laboratorio
                    </h6>
                    <p className="mb-2">
                        En esta pestaña puedes configurar qué ejercicios son <strong>de reto</strong> o{" "}
                        <strong>tiquismiquis</strong>.
                    </p>
                    <ul className="mb-2 small">
                        <li>
                            <strong>Ejercicios de reto:</strong> No se pueden pedir explicaciones, pero sí evaluaciones
                            de soluciones.
                        </li>
                        <li>
                            <strong>Ejercicios tiquismiquis:</strong> Se muestra una advertencia al pedir explicación
                            porque pueden contener respuestas parciales en el enunciado.
                        </li>
                    </ul>
                    <p className="mb-0 small">
                        Después de guardar cambios, el sistema actualizará automáticamente las restricciones.
                    </p>
                </div>
                {/* Botón para identificar ejercicios */}
                {onIdentifyExercises && pageId && (
                    <div className="mb-3">
                        <button
                            type="button"
                            className="btn btn-outline-primary w-100"
                            onClick={onIdentifyExercises}
                            disabled={isLoadingExercises}
                        >
                            {isLoadingExercises ? (
                                <>
                                    <span
                                        className="spinner-border spinner-border-sm me-2"
                                        role="status"
                                        aria-hidden="true"
                                    ></span>
                                    Analizando la página...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-arrow-clockwise me-2"></i>
                                    Identificar ejercicios de la página
                                </>
                            )}
                        </button>
                        <small className="text-muted d-block mt-1">
                            Presiona el botón para analizar la página y detectar ejercicios disponibles.
                        </small>
                    </div>
                )}
                <div className="alert alert-info" role="alert">
                    <strong>No hay ejercicios disponibles</strong>
                    <p className="mb-0 mt-2 small">
                        Cuando se detecten ejercicios en la página, podrás configurar cuáles son ejercicios de reto.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> Configuración de ejercicios
                </h6>
                <p className="mb-2">
                    En esta pestaña puedes configurar qué ejercicios son <strong>de reto</strong> o{" "}
                    <strong>tiquismiquis</strong>.
                </p>
                <ul className="mb-2 small">
                    <li>
                        <strong>Ejercicios de reto:</strong> No se pueden pedir explicaciones, pero sí evaluaciones de
                        soluciones.
                    </li>
                    <li>
                        <strong>Ejercicios tiquismiquis:</strong> Se muestra una advertencia al pedir explicación porque
                        pueden contener respuestas parciales en el enunciado.
                    </li>
                </ul>
                <p className="mb-0 small">
                    Después de guardar cambios, el sistema actualizará automáticamente las restricciones.
                </p>
            </div>

            {/* Botón para re-identificar ejercicios */}
            {onIdentifyExercises && pageId && (
                <div className="mb-3">
                    <button
                        type="button"
                        className="btn btn-outline-primary w-100"
                        onClick={onIdentifyExercises}
                        disabled={isLoadingExercises}
                    >
                        {isLoadingExercises ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                ></span>
                                Analizando la página...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-arrow-clockwise me-2"></i>
                                {exercises.length > 0
                                    ? "Re-identificar ejercicios de la página"
                                    : "Identificar ejercicios de la página"}
                            </>
                        )}
                    </button>
                    {exercises.length > 0 && (
                        <small className="text-muted d-block mt-1">
                            Esto volverá a analizar la página para detectar ejercicios nuevos o modificados.
                        </small>
                    )}
                </div>
            )}

            <div className="table-responsive">
                <table className="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th scope="col" style={{ width: "60%" }}>
                                Nombre del ejercicio
                            </th>
                            <th scope="col" className="text-center" style={{ width: "20%" }}>
                                Es reto
                            </th>
                            <th scope="col" className="text-center" style={{ width: "20%" }}>
                                Es tiquismiquis
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {exercises.map(exercise => {
                            const flags = exerciseConfig.get(exercise.name) ?? getDefaultFlags();
                            const isChallenge = !flags.allowed;
                            const isTiquismiqui = flags.isTiquismiqui;
                            return (
                                <tr key={exercise.name}>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            <span>{exercise.name}</span>
                                            {isChallenge && (
                                                <span className="badge bg-warning text-dark ms-2">Reto</span>
                                            )}
                                            {isTiquismiqui && (
                                                <span className="badge bg-info text-dark ms-2">Tiquismiquis</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="form-check form-switch d-inline-block">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id={`challenge-switch-${exercise.name}`}
                                                checked={isChallenge}
                                                onChange={() => handleToggleChallenge(exercise.name)}
                                                disabled={isSaving}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <label
                                                className="form-check-label visually-hidden"
                                                htmlFor={`challenge-switch-${exercise.name}`}
                                            >
                                                {isChallenge ? "Es reto" : "No es reto"}
                                            </label>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="form-check form-switch d-inline-block">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id={`tiquismiqui-switch-${exercise.name}`}
                                                checked={isTiquismiqui}
                                                onChange={() => handleToggleTiquismiqui(exercise.name)}
                                                disabled={isSaving}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <label
                                                className="form-check-label visually-hidden"
                                                htmlFor={`tiquismiqui-switch-${exercise.name}`}
                                            >
                                                {isTiquismiqui ? "Es tiquismiquis" : "No es tiquismiquis"}
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
                    Aplicando configuración y actualizando las restricciones...
                </div>
            )}
        </div>
    );
};

export default ExerciseConfigTab;
