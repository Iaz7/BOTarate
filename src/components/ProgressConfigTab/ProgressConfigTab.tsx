import React from "react";
import { useTranslation } from "react-i18next";
import { useProgressConfig } from "./hooks";
import { ProgressConfigTabProps } from "./types";

const ProgressConfigTab: React.FC<ProgressConfigTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const {
        config,
        isLoading,
        isSaving,
        statusMessage,
        hasChanges,
        handleNumberChange,
        handleSave,
        handleRestoreDefaults,
    } = useProgressConfig(isActive);

    if (isLoading) {
        return (
            <div className="text-center py-4">
                <output className="spinner-border">
                    <span className="visually-hidden">{t("common.loading")}</span>
                </output>
                <p className="text-muted small mt-2">{t("options.progress.loading")}</p>
            </div>
        );
    }

    return (
        <div>
            <div className="alert alert-info small" role="alert">
                <strong>{t("options.progress.info.title")}</strong>
                <p className="mb-0 mt-1">{t("options.progress.info.desc")}</p>
            </div>

            {statusMessage && (
                <div className={`alert alert-${statusMessage.type === "success" ? "success" : "danger"}`} role="alert">
                    {statusMessage.text}
                </div>
            )}

            <div className="mb-4">
                <label htmlFor="minScore" className="form-label fw-semibold">
                    {t("options.progress.minScore.label")}
                </label>
                <div className="input-group">
                    <input
                        id="minScore"
                        type="number"
                        className="form-control"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.minScoreToPass}
                        onChange={event => handleNumberChange("minScoreToPass", event.target.value)}
                        disabled={isSaving}
                    />
                    <span className="input-group-text">/ 10</span>
                </div>
                <div className="form-text">{t("options.progress.minScore.help")}</div>
            </div>

            <div className="mb-4">
                <label htmlFor="minPercentage" className="form-label fw-semibold">
                    {t("options.progress.minPercentage.label")}
                </label>
                <div className="input-group">
                    <input
                        id="minPercentage"
                        type="number"
                        className="form-control"
                        min={0}
                        max={100}
                        step={5}
                        value={config.minChallengesPercentage}
                        onChange={event => handleNumberChange("minChallengesPercentage", event.target.value)}
                        disabled={isSaving}
                    />
                    <span className="input-group-text">%</span>
                </div>
                <div className="form-text">{t("options.progress.minPercentage.help")}</div>
            </div>

            <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges || isSaving}>
                    {isSaving ? (
                        <>
                            <output className="spinner-border spinner-border-sm me-2">
                                <span className="visually-hidden">{t("common.loading")}</span>
                            </output>
                            {t("options.progress.saving")}
                        </>
                    ) : (
                        t("options.progress.save")
                    )}
                </button>
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={handleRestoreDefaults}
                    disabled={isSaving}
                >
                    {t("options.progress.restore")}
                </button>
            </div>
        </div>
    );
};

export default ProgressConfigTab;
