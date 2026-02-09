import { useEffect, useState } from "react";
import { ExerciseEditModalProps } from "./types";

export const useExerciseEditModal = ({
    exercise,
    isOpen,
    labId,
    isAddMode,
    onExerciseUpdate,
    onClose,
}: ExerciseEditModalProps) => {
    const [name, setName] = useState("");
    const [statement, setStatement] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (isAddMode) {
                setName("");
                setStatement("");
            } else if (exercise) {
                setName(exercise.name);
                setStatement(exercise.statement);
            }
            setError(null);
        }
    }, [isOpen, exercise, isAddMode]);

    const hasChanges = isAddMode
        ? name.trim().length > 0
        : (exercise && (name !== exercise.name || statement !== exercise.statement)) ?? false;

    const handleSave = async () => {
        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            if (isAddMode) {
                await chrome.runtime.sendMessage({
                    action: "addExercise",
                    pageId: labId,
                    exercise: { name: name.trim(), statement: statement.trim() },
                });
            } else {
                await chrome.runtime.sendMessage({
                    action: "updateExercise",
                    pageId: labId,
                    oldName: exercise?.name,
                    exercise: { name: name.trim(), statement: statement.trim() },
                });
            }
            if (onExerciseUpdate) onExerciseUpdate();
            onClose();
        } catch (err) {
            console.error("Error saving exercise:", err);
            setError("Error saving exercise");
        } finally {
            setIsSaving(false);
        }
    };

    return {
        name,
        setName,
        statement,
        setStatement,
        isSaving,
        error,
        hasChanges,
        handleSave,
    };
};