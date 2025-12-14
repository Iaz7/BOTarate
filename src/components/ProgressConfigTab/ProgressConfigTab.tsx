import React from "react";
import { useProgressConfig } from "./hooks";
import { ProgressConfigTabProps } from "./types";

const ProgressConfigTab: React.FC<ProgressConfigTabProps> = ({ isActive }) => {
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
                    <span className="visually-hidden">Loading configuration...</span>
                </output>
                <p className="text-muted small mt-2">Loading progress configuration...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="alert alert-info small" role="alert">
                <strong>Configure criteria to unlock labs</strong>
                <p className="mb-0 mt-1">
                    Adjust the minimum score and percentage of passed challenges needed to progress.
                </p>
            </div>

            {statusMessage && (
                <div className={`alert alert-${statusMessage.type === "success" ? "success" : "danger"}`} role="alert">
                    {statusMessage.text}
                </div>
            )}

            <div className="mb-4">
                <label htmlFor="minScore" className="form-label fw-semibold">
                    Minimum score to pass a challenge exercise
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
                <div className="form-text">
                    Challenges with a score equal to or higher than this value will be considered passed.
                </div>
            </div>

            <div className="mb-4">
                <label htmlFor="minPercentage" className="form-label fw-semibold">
                    Minimum percentage of passed challenges to progress
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
                <div className="form-text">
                    Example: with 75%, if a lab has 4 challenges, at least 3 must be passed to unlock the next one.
                </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges || isSaving}>
                    {isSaving ? (
                        <>
                            <output className="spinner-border spinner-border-sm me-2">
                                <span className="visually-hidden">Saving...</span>
                            </output>
                            Saving...
                        </>
                    ) : (
                        "Save criteria"
                    )}
                </button>
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={handleRestoreDefaults}
                    disabled={isSaving}
                >
                    Restore default values
                </button>
            </div>
        </div>
    );
};

export default ProgressConfigTab;
