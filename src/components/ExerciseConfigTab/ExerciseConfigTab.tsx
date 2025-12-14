import React from "react";
import { useExerciseConfig } from "./hooks";
import { ExerciseConfigTabProps } from "./types";
import { getDefaultFlags } from "./utils";

const ExerciseConfigTab: React.FC<ExerciseConfigTabProps> = props => {
    const {
        exerciseConfig,
        isSaving,
        hasUnsavedChanges,
        handleToggleChallenge,
        handleToggleTiquismiqui,
        handleSaveChanges,
    } = useExerciseConfig(props);

    if (props.exercises.length === 0) {
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
                        {props.exercises.map(exercise => {
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
