import { ExerciseStorageManager } from "../../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../../util/storage/ExplanationStorageManager";
import { LabStorageManager } from "../../util/storage/LabStorageManager";

export function handleRemoveExerciseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    (async () => {
        try {
            await ExerciseStorageManager.removeExerciseData(pageId);
            await ExplanationStorageManager.removeExplanationData(pageId);

            console.log(`Datos de ejercicios y explicaciones eliminados para la página: ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al eliminar datos:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleUpdateExerciseAllowed(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, allowed } = request;

    (async () => {
        try {
            await ExerciseStorageManager.updateExerciseAllowed(pageId, exerciseName, allowed);
            console.log(`Estado 'allowed' actualizado para ${exerciseName}: ${allowed}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar estado de ejercicio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleRemoveChallengeExercisesExplanations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseNames } = request;

    (async () => {
        try {
            for (const exerciseName of exerciseNames) {
                try {
                    await ExplanationStorageManager.removeExplanation(pageId, exerciseName);
                    console.log(`Explicación eliminada para ejercicio de reto: ${exerciseName}`);
                } catch (removeError) {
                    console.log(`No había explicación guardada para: ${exerciseName}`, removeError);
                }
            }

            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al eliminar explicaciones de ejercicios de reto:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleUpdateLabRequired(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, labId, required } = request;

    (async () => {
        try {
            await LabStorageManager.updateLabRequired(courseId, labId, required);
            console.log(`Estado 'required' actualizado para laboratorio ${labId}: ${required}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar estado de laboratorio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleSaveChatHistory(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, chatHistory } = request;

    console.log(`Guardando historial de chat para: ${exerciseName}`);

    (async () => {
        try {
            await ExplanationStorageManager.updateChatHistory(pageId, exerciseName, chatHistory);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al guardar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}
