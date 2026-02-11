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
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (isOpen && !isInitialized) {
            if (isAddMode) {
                setName("");
                setStatement("");
            } else if (exercise) {
                setName(exercise.name);
                setStatement(exercise.statement);
            }
            setError(null);
            setSuccessMessage(null);
            setIsInitialized(true);
        } else if (!isOpen) {
            setIsInitialized(false);
        }
    }, [isOpen, exercise, isAddMode, isInitialized]);

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
        setSuccessMessage(null);
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

            // Terminar el estado de guardado
            setIsSaving(false);

            // Mostrar mensaje de éxito
            setSuccessMessage(isAddMode ? "Exercise added successfully" : "Exercise updated successfully");

            // Actualizar la lista de ejercicios inmediatamente
            if (onExerciseUpdate) {
                onExerciseUpdate();
            }

            // Cerrar el modal después de mostrar el mensaje por 2 segundos
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error("Error saving exercise:", err);
            setError("Error saving exercise");
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
        successMessage,
        hasChanges,
        handleSave,
    };
};