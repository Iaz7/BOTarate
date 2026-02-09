import type { Course } from "../../util/egela/Course";
import { getUserCourses, isUserTeacherInCourse } from "../../util/egela/EgelaDashboard";
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
    const { config, courseId } = request;

    (async () => {
        try {
            const sanitizedConfig = {
                minScoreToPass: Math.min(Math.max(Number(config?.minScoreToPass ?? 5), 0), 10),
                minChallengesPercentage: Math.min(Math.max(Number(config?.minChallengesPercentage ?? 100), 0), 100),
            };

            await ProgressConfigStorageManager.saveConfig(sanitizedConfig, courseId);
            const logSuffix = courseId ? ' para curso ' + courseId : '';
            console.log('Configuración de progreso guardada' + logSuffix);
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
            // Si no hay caché válido, verificar el rol en Egela
            const course: Course = getCachedCourse();

            if (!course) {
                console.warn('[handleCheckUserRole] No se pudo determinar el curso, no se puede verificar el rol');
                sendResponse({ success: false, error: 'No se pudo determinar el curso', isTeacher: false });
                return;
            }

            const courseId = course.id;

            // Verificar si hay un caché válido del rol del usuario para este curso
            const cachedRole = await ModeStorageManager.getUserRoleForCourse(courseId);

            if (cachedRole && cachedRole.isValid) {
                console.log(`[handleCheckUserRole] Usando caché del rol para curso ${courseId}: ${cachedRole.isTeacher ? 'Profesor' : 'Alumno'}`);
                sendResponse({ success: true, isTeacher: cachedRole.isTeacher });
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

            console.log(`[handleCheckUserRole] Usuario es profesor en curso ${courseId}: ${isTeacher}`);

            // Guardar en caché para este curso
            await ModeStorageManager.saveUserRoleForCourse(courseId, isTeacher);

            sendResponse({ success: true, isTeacher });
        } catch (error: any) {
            console.error('[handleCheckUserRole] Error general al verificar rol del usuario:', error);
            sendResponse({ success: false, error: error.message, isTeacher: false });
        }
    })();

    return true;
}

export function handleUpdateLearningObjectives(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, learningObjectives } = request;
    (async () => {
        try {
            await ExerciseStorageManager.updateLearningObjectives(pageId, learningObjectives);
            console.log(`Learning objectives actualizados para página ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar learning objectives:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

export function handleUpdateExerciseContext(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseContext } = request;
    (async () => {
        try {
            await ExerciseStorageManager.updateExerciseContext(pageId, exerciseContext);
            console.log(`Contexto de ejercicios actualizado para página ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar contexto de ejercicios:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

export function handleUpdateConcepts(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, concepts } = request;
    (async () => {
        try {
            await ExerciseStorageManager.updateConcepts(pageId, concepts);
            console.log(`Conceptos actualizados para página ${pageId}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar conceptos:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

export function handleAddExercise(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exercise } = request;
    (async () => {
        try {
            await ExerciseStorageManager.addExercise(pageId, exercise);
            console.log(`Ejercicio añadido a página ${pageId}: ${exercise.name}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al añadir ejercicio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

export function handleRemoveExercise(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName } = request;
    (async () => {
        try {
            await ExerciseStorageManager.removeExercise(pageId, exerciseName);
            console.log(`Ejercicio eliminado de página ${pageId}: ${exerciseName}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al eliminar ejercicio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

export function handleUpdateExercise(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, oldName, exercise } = request;
    (async () => {
        try {
            await ExerciseStorageManager.updateExercise(pageId, oldName, exercise);
            console.log(`Ejercicio actualizado en página ${pageId}: ${oldName} -> ${exercise.name}`);
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al actualizar ejercicio:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}

/**
 * Fetches the user's course list from the eGela dashboard.
 */
export function handleGetUserCourses(_request: any, sendResponse: (response?: any) => void): boolean {
    (async () => {
        try {
            const courses = await getUserCourses();
            console.log(`[handleGetUserCourses] Found ${courses.length} courses`);
            sendResponse({ success: true, courses });
        } catch (error: any) {
            console.error('[handleGetUserCourses] Error:', error);
            const isSessionExpired = error.message?.includes('EgelaSessionExpired');
            sendResponse({
                success: false,
                error: error.message,
                isSessionExpired
            });
        }
    })();
    return true;
}

/**
 * Checks user role for a specific course with per-course caching.
 */
export function handleCheckUserRoleForCourse(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId } = request;

    (async () => {
        try {
            if (!courseId) {
                sendResponse({ success: false, error: 'courseId is required', isTeacher: false });
                return;
            }

            // Check per-course cache first
            const cachedRole = await ModeStorageManager.getUserRoleForCourse(courseId);
            if (cachedRole && cachedRole.isValid) {
                console.log(`[handleCheckUserRoleForCourse] Using cache for course ${courseId}: ${cachedRole.isTeacher ? 'Teacher' : 'Student'}`);
                sendResponse({ success: true, isTeacher: cachedRole.isTeacher });
                return;
            }

            // No valid cache, check role in Egela
            const isTeacher = await isUserTeacherInCourse(courseId);
            console.log(`[handleCheckUserRoleForCourse] User is teacher in course ${courseId}: ${isTeacher}`);

            // Cache the result
            await ModeStorageManager.saveUserRoleForCourse(courseId, isTeacher);

            sendResponse({ success: true, isTeacher });
        } catch (error: any) {
            console.error('[handleCheckUserRoleForCourse] Error:', error);
            const isSessionExpired = error.message?.includes('EgelaSessionExpired');
            sendResponse({
                success: false,
                error: error.message,
                isTeacher: false,
                isSessionExpired
            });
        }
    })();
    return true;
}