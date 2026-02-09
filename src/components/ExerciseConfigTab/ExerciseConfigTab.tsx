import React from "react";
import { useTranslation } from "react-i18next";
import ExerciseEditModal from "../ExerciseEditModal";
import { useExerciseConfig } from "./hooks";
import { ExerciseConfigTabProps } from "./types";
import { getDefaultFlags } from "./utils";

const ExerciseConfigTab: React.FC<ExerciseConfigTabProps> = props => {
    const { t } = useTranslation();
    const {
        exerciseConfig,
        isSaving,
        hasUnsavedChanges,
        successMessage,
        errorMessage,
        handleToggleChallenge,
        handleTogglePicky,
        handleSaveChanges,
        editingExercise,
        setEditingExercise,
        isAddingExercise,
        setIsAddingExercise,
        handleDeleteExercise,
        refreshExercises,
    } = useExerciseConfig(props);

    // Función auxiliar para renderizar HTML seguro
    const renderHTML = (html: string) => <span dangerouslySetInnerHTML={{ __html: html }} />;

    const isInLab = props.pageId && props.pageId.trim() !== "";

    if (props.exercises.length === 0) {
        return (
            <div>
                {/* Explicación del sistema */}
                <div className="alert alert-primary small mb-3" role="alert">
                    <h6 className="alert-heading">
                        <i className="bi bi-info-circle"></i> {t("options.exerciseConfig.infoTitle")}
                    </h6>
                    <p className="mb-2">{renderHTML(t("options.exerciseConfig.infoDesc"))}</p>
                    <ul className="mb-2 small">
                        <li>{renderHTML(t("options.exerciseConfig.infoList.challenge"))}</li>
                        <li>{renderHTML(t("options.exerciseConfig.infoList.picky"))}</li>
                    </ul>
                    <p className="mb-0 small">{t("options.exerciseConfig.infoFooter")}</p>
                </div>
                <div className="alert alert-info" role="alert">
                    <strong>{t("options.exerciseConfig.noExercisesTitle")}</strong>
                    <p className="mb-0 mt-2 small">
                        {isInLab
                            ? t("options.exerciseConfig.noExercisesDesc")
                            : t("options.exerciseConfig.noLabOpenDesc")}
                    </p>
                </div>

                {isInLab && (
                    <div className="d-grid gap-2 mt-3">
                        <button className="btn btn-primary" onClick={() => setIsAddingExercise(true)}>
                            <i className="bi bi-plus-circle me-2"></i>
                            {t("options.exerciseConfig.addExercise")}
                        </button>
                    </div>
                )}

                {/* Add Exercise Modal */}
                {isAddingExercise && (
                    <ExerciseEditModal
                        isOpen={isAddingExercise}
                        onClose={() => setIsAddingExercise(false)}
                        labId={props.pageId}
                        isAddMode={true}
                        onExerciseUpdate={refreshExercises}
                    />
                )}
            </div>
        );
    }

    return (
        <div>
            {/* Explicación del sistema */}
            <div className="alert alert-primary small mb-3" role="alert">
                <h6 className="alert-heading">
                    <i className="bi bi-info-circle"></i> {t("options.exerciseConfig.infoTitle")}
                </h6>
                <p className="mb-2">{renderHTML(t("options.exerciseConfig.infoDesc"))}</p>
                <ul className="mb-2 small">
                    <li>{renderHTML(t("options.exerciseConfig.infoList.challenge"))}</li>
                    <li>{renderHTML(t("options.exerciseConfig.infoList.picky"))}</li>
                </ul>
                <p className="mb-0 small">{t("options.exerciseConfig.infoFooter")}</p>
            </div>

            <div className="table-responsive">
                <table className="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th scope="col" style={{ width: "60%" }}>
                                {t("options.exerciseConfig.table.headerName")}
                            </th>
                            <th scope="col" className="text-center" style={{ width: "20%" }}>
                                {t("options.exerciseConfig.table.headerChallenge")}
                            </th>
                            <th scope="col" className="text-center" style={{ width: "20%" }}>
                                {t("options.exerciseConfig.table.headerPicky")}
                            </th>
                            <th scope="col" className="text-center" style={{ width: "10%" }}>
                                {t("options.exerciseConfig.table.headerActions")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {props.exercises.map(exercise => {
                            const flags = exerciseConfig.get(exercise.name) ?? getDefaultFlags();
                            const isChallenge = !flags.allowed;
                            const isPicky = flags.isPicky;
                            return (
                                <tr key={exercise.name}>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            <span>{exercise.name}</span>
                                            {isChallenge && (
                                                <span className="badge bg-warning text-dark ms-2">
                                                    {t("options.exerciseConfig.table.badgeChallenge")}
                                                </span>
                                            )}
                                            {isPicky && (
                                                <span className="badge bg-info text-dark ms-2">
                                                    {t("options.exerciseConfig.table.badgePicky")}
                                                </span>
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
                                                {isChallenge
                                                    ? t("options.exerciseConfig.table.switchChallengeOn")
                                                    : t("options.exerciseConfig.table.switchChallengeOff")}
                                            </label>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="form-check form-switch d-inline-block">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id={`picky-switch-${exercise.name}`}
                                                checked={isPicky}
                                                onChange={() => handleTogglePicky(exercise.name)}
                                                disabled={isSaving}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <label
                                                className="form-check-label visually-hidden"
                                                htmlFor={`picky-switch-${exercise.name}`}
                                            >
                                                {isPicky
                                                    ? t("options.exerciseConfig.table.switchPickyOn")
                                                    : t("options.exerciseConfig.table.switchPickyOff")}
                                            </label>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="d-flex gap-1 justify-content-center align-items-center">
                                            <button
                                                className="btn btn-outline-primary btn-sm"
                                                onClick={() => setEditingExercise(exercise)}
                                                disabled={isSaving}
                                                title={t("common.edit")}
                                                style={{
                                                    padding: "0.25rem 0.5rem",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="14"
                                                    height="14"
                                                    fill="currentColor"
                                                    viewBox="0 0 16 16"
                                                >
                                                    <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z" />
                                                </svg>
                                            </button>
                                            <button
                                                className="btn btn-outline-danger btn-sm"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            t("options.exerciseConfig.deleteConfirm", {
                                                                name: exercise.name,
                                                            }),
                                                        )
                                                    ) {
                                                        handleDeleteExercise(exercise.name);
                                                    }
                                                }}
                                                disabled={isSaving}
                                                title={t("common.delete")}
                                                style={{
                                                    padding: "0.25rem 0.5rem",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="14"
                                                    height="14"
                                                    fill="currentColor"
                                                    viewBox="0 0 16 16"
                                                >
                                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                                                    />
                                                </svg>
                                            </button>
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
                    <strong>{t("options.exerciseConfig.unsavedTitle")}</strong>
                    <p className="mb-0 mt-1">{t("options.exerciseConfig.unsavedDesc")}</p>
                </div>
            )}

            <div className="d-grid gap-2 mb-3">
                <button className="btn btn-success" onClick={() => setIsAddingExercise(true)} disabled={isSaving}>
                    <i className="bi bi-plus-circle me-2"></i>
                    {t("options.exerciseConfig.addExercise")}
                </button>
            </div>

            <div className="d-grid gap-2">
                <button
                    className="btn btn-primary"
                    onClick={handleSaveChanges}
                    disabled={isSaving || !hasUnsavedChanges}
                >
                    {isSaving ? (
                        <>
                            <output className="spinner-border spinner-border-sm me-2">
                                <span className="visually-hidden">{t("common.saving")}</span>
                            </output>
                            {t("options.exerciseConfig.saving")}
                        </>
                    ) : (
                        t("options.exerciseConfig.save")
                    )}
                </button>
            </div>

            {successMessage && (
                <div className="alert alert-success mt-3" role="alert">
                    <h6 className="alert-heading d-flex align-items-center">
                        <i className="bi bi-check-circle me-2"></i>
                        {t("common.success")}
                    </h6>
                    <hr />
                    <p className="mb-0">{successMessage}</p>
                </div>
            )}

            {errorMessage && (
                <div className="alert alert-danger mt-3" role="alert">
                    <h6 className="alert-heading d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {t("common.error")}
                    </h6>
                    <hr />
                    <p className="mb-0">{errorMessage}</p>
                </div>
            )}

            {isSaving && (
                <div className="alert alert-secondary small d-flex align-items-center mt-2" role="alert">
                    <output className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">{t("common.saving")}</span>
                    </output>
                    {t("options.exerciseConfig.processing")}
                </div>
            )}

            {/* Exercise Edit Modal */}
            {editingExercise && (
                <ExerciseEditModal
                    isOpen={!!editingExercise}
                    onClose={() => setEditingExercise(null)}
                    exercise={editingExercise}
                    labId={props.pageId}
                    onExerciseUpdate={refreshExercises}
                />
            )}

            {/* Add Exercise Modal */}
            {isAddingExercise && (
                <ExerciseEditModal
                    isOpen={isAddingExercise}
                    onClose={() => setIsAddingExercise(false)}
                    labId={props.pageId}
                    isAddMode={true}
                    onExerciseUpdate={refreshExercises}
                />
            )}
        </div>
    );
};

export default React.memo(ExerciseConfigTab);