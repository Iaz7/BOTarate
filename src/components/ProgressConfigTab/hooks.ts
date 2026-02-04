import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_CONFIG } from "./constants";
import { ProgressConfigForm, StatusMessage } from "./types";

export const useProgressConfig = (isActive: boolean) => {
    const { t } = useTranslation();
    const [config, setConfig] = useState<ProgressConfigForm>(DEFAULT_CONFIG);
    const [originalConfig, setOriginalConfig] = useState<ProgressConfigForm | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);

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
                setStatusMessage({ type: "error", text: t('options.progress.errorLoad', 'Could not load configuration. Please try again.') });
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
                setStatusMessage({ type: "success", text: t('options.progress.successSave', 'Progress criteria saved successfully.') });
            } else {
                throw new Error(response?.error || "Error saving configuration");
            }
        } catch (error) {
            console.error("[ProgressConfigTab] Error saving configuration:", error);
            setStatusMessage({ type: "error", text: t('options.progress.errorSave', 'Could not save. Check values and try again.') });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRestoreDefaults = () => {
        setConfig(DEFAULT_CONFIG);
        setStatusMessage(null);
    };

    return {
        config,
        isLoading,
        isSaving,
        statusMessage,
        hasChanges,
        handleNumberChange,
        handleSave,
        handleRestoreDefaults,
    };
};