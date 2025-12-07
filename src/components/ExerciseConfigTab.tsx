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

            alert("Configuration saved successfully. The assistant has been updated with the new configuration.");
        } catch (error) {
            console.error("Error saving exercise config:", error);
            alert("Error saving configuration. Please try again.");
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
                        <i className="bi bi-info-circle"></i> Lab configuration
                    </h6>
                    <p className="mb-2">
                        In this tab you can configure which exercises are <strong>challenge</strong> or{" "}
                        <strong>picky</strong>.
                    </p>
                    <ul className="mb-2 small">
                        <li>
                            <strong>Challenge exercises:</strong> Explanations cannot be requested, but solution
                            evaluations can.
                        </li>
                        <li>
                            <strong>Picky exercises:</strong> A warning is shown when asking for an explanation because
                            they may contain partial answers in the statement.
                        </li>
                    </ul>
                    <p className="mb-0 small">
                        After saving changes, the system will automatically update the restrictions.
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
                                    Analyzing page...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-arrow-clockwise me-2"></i>
                                    Identify page exercises
                                </>
                            )}
                        </button>
                        <small className="text-muted d-block mt-1">
                            Press the button to analyze the page and detect available exercises.
                        </small>
                    </div>
                )}
                <div className="alert alert-info" role="alert">
                    <strong>No exercises available</strong>
                    <p className="mb-0 mt-2 small">
                        When exercises are detected on the page, you can configure which ones are challenge exercises.
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
                    <i className="bi bi-info-circle"></i> Exercise configuration
                </h6>
                <p className="mb-2">
                    In this tab you can configure which exercises are <strong>challenge</strong> or{" "}
                    <strong>picky</strong>.
                </p>
                <ul className="mb-2 small">
                    <li>
                        <strong>Challenge exercises:</strong> Explanations cannot be requested, but solution evaluations
                        can.
                    </li>
                    <li>
                        <strong>Picky exercises:</strong> A warning is shown when asking for an explanation because they
                        may contain partial answers in the statement.
                    </li>
                </ul>
                <p className="mb-0 small">
                    After saving changes, the system will automatically update the restrictions.
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
                                Analyzing page...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-arrow-clockwise me-2"></i>
                                {exercises.length > 0 ? "Reset lab exercises" : "Identify page exercises"}
                            </>
                        )}
                    </button>
                    {exercises.length > 0 && (
                        <small className="text-muted d-block mt-1">
                            This will re-analyze the page to detect new or modified exercises.
                        </small>
                    )}
                </div>
            )}

            <div className="table-responsive">
                <table className="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th scope="col" style={{ width: "60%" }}>
                                Exercise name
                            </th>
                            <th scope="col" className="text-center" style={{ width: "20%" }}>
                                Is challenge
                            </th>
                            <th scope="col" className="text-center" style={{ width: "20%" }}>
                                Is picky
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
                                                <span className="badge bg-warning text-dark ms-2">Challenge</span>
                                            )}
                                            {isTiquismiqui && (
                                                <span className="badge bg-info text-dark ms-2">Picky</span>
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
                                                {isChallenge ? "Is challenge" : "Not challenge"}
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
                                                {isTiquismiqui ? "Is picky" : "Not picky"}
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
                    <strong>⚠️ You have unsaved changes</strong>
                    <p className="mb-0 mt-1">
                        Click "Save changes" to apply the configuration and regenerate the assistant.
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
                                <span className="visually-hidden">Saving...</span>
                            </output>
                            Saving changes...
                        </>
                    ) : (
                        "Save changes"
                    )}
                </button>
            </div>

            {isSaving && (
                <div className="alert alert-secondary small d-flex align-items-center mt-2" role="alert">
                    <output className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">Saving...</span>
                    </output>
                    Applying configuration and updating restrictions...
                </div>
            )}
        </div>
    );
};

export default ExerciseConfigTab;
