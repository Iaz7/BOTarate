import React, { useEffect, useMemo, useState } from "react";

interface ProgressConfigTabProps {
    isActive: boolean;
}

interface ProgressConfigForm {
    minScoreToPass: number;
    minChallengesPercentage: number;
}

const DEFAULT_CONFIG: ProgressConfigForm = {
    minScoreToPass: 5,
    minChallengesPercentage: 100,
};

const ProgressConfigTab: React.FC<ProgressConfigTabProps> = ({ isActive }) => {
    const [config, setConfig] = useState<ProgressConfigForm>(DEFAULT_CONFIG);
    const [originalConfig, setOriginalConfig] = useState<ProgressConfigForm | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const hasChanges = useMemo(() => {
        if (!originalConfig) return false;
        return (
            Number(config.minScoreToPass).toFixed(2) !== Number(originalConfig.minScoreToPass).toFixed(2) ||
            Number(config.minChallengesPercentage).toFixed(2) !==
                Number(originalConfig.minChallengesPercentage).toFixed(2)
        );
    }, [config, originalConfig]);

    useEffect(() => {
        if (!isActive) return;

        const loadProgressConfig = async () => {
            setIsLoading(true);
            setStatusMessage(null);
            try {
                const response = await chrome.runtime.sendMessage({
                    action: "getProgressConfig",
                });

                if (response?.success && response.config) {
                    const minScore = Number(response.config.minScoreToPass);
                    const minPercentage = Number(response.config.minChallengesPercentage);
                    const nextConfig: ProgressConfigForm = {
                        minScoreToPass: Number.isFinite(minScore) ? minScore : DEFAULT_CONFIG.minScoreToPass,
                        minChallengesPercentage: Number.isFinite(minPercentage)
                            ? minPercentage
                            : DEFAULT_CONFIG.minChallengesPercentage,
                    };
                    setConfig(nextConfig);
                    setOriginalConfig(nextConfig);
                } else {
                    setConfig(DEFAULT_CONFIG);
                    setOriginalConfig(DEFAULT_CONFIG);
                }
            } catch (error) {
                console.error("[ProgressConfigTab] Error loading progress configuration:", error);
                setStatusMessage({ type: "error", text: "Could not load configuration. Please try again." });
            } finally {
                setIsLoading(false);
            }
        };

        loadProgressConfig();
    }, [isActive]);

    const handleNumberChange = (field: keyof ProgressConfigForm, value: string) => {
        const numericValue = Number(value);
        setConfig(prev => ({
            ...prev,
            [field]: Number.isFinite(numericValue) ? numericValue : prev[field],
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatusMessage(null);
        try {
            const payload: ProgressConfigForm = {
                minScoreToPass: Math.min(Math.max(config.minScoreToPass, 0), 10),
                minChallengesPercentage: Math.min(Math.max(config.minChallengesPercentage, 0), 100),
            };

            const response = await chrome.runtime.sendMessage({
                action: "saveProgressConfig",
                config: payload,
            });

            if (response?.success) {
                setOriginalConfig(payload);
                setConfig(payload);
                setStatusMessage({ type: "success", text: "Progress criteria saved successfully." });
            } else {
                throw new Error(response?.error || "Error saving configuration");
            }
        } catch (error) {
            console.error("[ProgressConfigTab] Error saving configuration:", error);
            setStatusMessage({ type: "error", text: "Could not save. Check values and try again." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRestoreDefaults = () => {
        setConfig(DEFAULT_CONFIG);
        setStatusMessage(null);
    };

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
