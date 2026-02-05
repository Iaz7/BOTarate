import { useEffect, useState } from 'react';
import { ExerciseConfigTabProps, ExerciseFlags } from './types';
import { buildConfigMap, computePendingChanges, configsAreEqual, getDefaultFlags } from './utils';

export const useExerciseConfig = ({ exercises, pageId, onConfigUpdate, isActive }: ExerciseConfigTabProps) => {
    const [exerciseConfig, setExerciseConfig] = useState<Map<string, ExerciseFlags>>(new Map());
    const [originalConfig, setOriginalConfig] = useState<Map<string, ExerciseFlags>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setHasUnsavedChanges(!configsAreEqual(exerciseConfig, originalConfig));
    }, [exerciseConfig, originalConfig]);

    // Limpiar mensajes después de 5 segundos
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    useEffect(() => {
        if (isActive && pageId) {
            loadConfigFromStorage();
        }
    }, [isActive, pageId]);

    const loadConfigFromStorage = async () => {
        try {
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

    const handleTogglePicky = (exerciseName: string) => {
        updateExerciseFlags(exerciseName, flags => ({ ...flags, isPicky: !flags.isPicky }));
    };

    const handleSaveChanges = async () => {
        const changes = computePendingChanges(exerciseConfig, originalConfig);
        if (changes.length === 0) return;

        setSuccessMessage(null);
        setErrorMessage(null);
        setIsSaving(true);
        try {
            for (const change of changes) {
                if (change.allowed !== undefined) {
                    await chrome.runtime.sendMessage({
                        action: "updateExerciseAllowed",
                        pageId: pageId,
                        exerciseName: change.name,
                        allowed: change.allowed,
                    });
                }

                if (change.isPicky !== undefined) {
                    await chrome.runtime.sendMessage({
                        action: "updateExercisePicky",
                        pageId: pageId,
                        exerciseName: change.name,
                        isPicky: change.isPicky,
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

            if (onConfigUpdate) {
                onConfigUpdate();
            }

            setSuccessMessage("Configuration saved successfully. The assistant has been updated with the new configuration.");
        } catch (error) {
            console.error("Error saving exercise config:", error);
            setErrorMessage("Error saving configuration. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return {
        exerciseConfig,
        isSaving,
        hasUnsavedChanges,
        successMessage,
        errorMessage,
        handleToggleChallenge,
        handleTogglePicky,
        handleSaveChanges,
    };
};