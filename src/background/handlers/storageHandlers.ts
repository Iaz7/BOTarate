import type { Course } from "../../util/egela/Course";
import { ExerciseStorageManager } from "../../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../../util/storage/ExplanationStorageManager";
import { LabStorageManager, ReasoningEffort, VerbosityLevel } from "../../util/storage/LabStorageManager";
import { ModeStorageManager } from "../../util/storage/ModeStorageManager";
import { ProgressConfigStorageManager } from "../../util/storage/ProgressConfigStorageManager";
import { getCachedCourse } from "./dataHandlers";

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

export function handleUpdateExercisePicky(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, isPicky } = request;

    (async () => {
        try {
            await ExerciseStorageManager.updateExercisePicky(pageId, exerciseName, isPicky);
            console.log(`Estado 'picky' actualizado para ${exerciseName}: ${isPicky}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar picky del ejercicio:', error);
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

export function handleUpdateLabVerbosity(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, labId, verbosity } = request;

    (async () => {
        try {
            await LabStorageManager.updateLabVerbosity(courseId, labId, verbosity as VerbosityLevel);
            console.log(`Verbosidad actualizada para laboratorio ${labId}: ${verbosity}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar verbosidad del laboratorio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleUpdateLabReasoningEffort(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, labId, reasoningEffort } = request;

    (async () => {
        try {
            await LabStorageManager.updateLabReasoningEffort(courseId, labId, reasoningEffort as ReasoningEffort);
            console.log(`Esfuerzo de razonamiento actualizado para laboratorio ${labId}: ${reasoningEffort}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar esfuerzo de razonamiento del laboratorio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetLabConfig(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId, labId } = request;

    (async () => {
        try {
            const labConfig = await LabStorageManager.getLabConfig(courseId, labId);
            if (labConfig) {
                console.log(`Configuración del laboratorio ${labId} recuperada`);
                sendResponse({ success: true, config: labConfig });
            } else {
                sendResponse({ success: false, error: 'No se encontró configuración para este laboratorio' });
            }
        } catch (error: any) {
            console.error('Error al obtener configuración del laboratorio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleSaveProgressConfig(request: any, sendResponse: (response?: any) => void): boolean {
    const { config } = request;

    (async () => {
        try {
            const sanitizedConfig = {
                minScoreToPass: Math.min(Math.max(Number(config?.minScoreToPass ?? 5), 0), 10),
                minChallengesPercentage: Math.min(Math.max(Number(config?.minChallengesPercentage ?? 100), 0), 100),
            };

            await ProgressConfigStorageManager.saveConfig(sanitizedConfig);
            console.log("Configuración de progreso global guardada");
            sendResponse({ success: true, config: sanitizedConfig });
        } catch (error: any) {
            console.error("Error al guardar configuración de progreso:", error);
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

export function handleCheckUserRole(request: any, sendResponse: (response?: any) => void): boolean {
    (async () => {
        try {
            // Verificar si hay un caché válido del rol del usuario
            const cachedRole = await ModeStorageManager.getUserRole();

            if (cachedRole && cachedRole.isValid) {
                console.log(`[handleCheckUserRole] Usando caché del rol: ${cachedRole.isTeacher ? 'Profesor' : 'Alumno'}`);
                sendResponse({ success: true, isTeacher: cachedRole.isTeacher });
                return;
            }

            // Si no hay caché válido, verificar el rol en Egela
            const course: Course = getCachedCourse();

            if (!course) {
                console.warn('[handleCheckUserRole] No se pudo determinar el curso, no se puede verificar el rol');
                sendResponse({ success: false, error: 'No se pudo determinar el curso', isTeacher: false });
                return;
            }

            // Verificar el rol del usuario
            let isTeacher;
            try {
                isTeacher = await course.isCurrentUserTeacher();
            } catch (error: any) {
                console.error('[handleCheckUserRole] Error al verificar rol del usuario en Egela:', error);
                sendResponse({ success: false, error: error.message, isTeacher: false });
                return;
            }

            console.log(`[handleCheckUserRole] Usuario es profesor: ${isTeacher}`);

            // Guardar en caché solo si la verificación fue exitosa
            await ModeStorageManager.saveUserRole(isTeacher);

            sendResponse({ success: true, isTeacher });
        } catch (error: any) {
            console.error('[handleCheckUserRole] Error general al verificar rol del usuario:', error);
            sendResponse({ success: false, error: error.message, isTeacher: false });
        }
    })();

    return true;
}