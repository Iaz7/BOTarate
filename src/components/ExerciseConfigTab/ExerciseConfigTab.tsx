import React from "react";
import { useTranslation } from "react-i18next";
import { useExerciseConfig } from "./hooks";
import { ExerciseConfigTabProps } from "./types";
import { getDefaultFlags } from "./utils";

const ExerciseConfigTab: React.FC<ExerciseConfigTabProps> = props => {
    const { t } = useTranslation();
    const { exerciseConfig, isSaving, hasUnsavedChanges, handleToggleChallenge, handleTogglePicky, handleSaveChanges } =
        useExerciseConfig(props);

    // Función auxiliar para renderizar HTML seguro
    const renderHTML = (html: string) => <span dangerouslySetInnerHTML={{ __html: html }} />;

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
                    <p className="mb-0 mt-2 small">{t("options.exerciseConfig.noExercisesDesc")}</p>
                </div>
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

            {isSaving && (
                <div className="alert alert-secondary small d-flex align-items-center mt-2" role="alert">
                    <output className="spinner-border spinner-border-sm me-2">
                        <span className="visually-hidden">{t("common.saving")}</span>
                    </output>
                    {t("options.exerciseConfig.processing")}
                </div>
            )}
        </div>
    );
};

export default ExerciseConfigTab;
