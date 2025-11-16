import { Course } from "../../util/egela/Course";
import { Exercise } from "../../util/egela/Exercise";
import { EvaluationStorageManager } from "../../util/storage/EvaluationStorageManager";
import { ExerciseStorageManager } from "../../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../../util/storage/ExplanationStorageManager";
import { Lab, LabStorageManager } from "../../util/storage/LabStorageManager";
import { ProgressConfigStorageManager } from "../../util/storage/ProgressConfigStorageManager";
import { getCourseAssistant, getEvaluationAssistant, getExerciseAssistant, getExplanationAssistant } from "../context";

export function handleGetCourseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { href, sessionStorageData } = request;
    const courseAssistant = getCourseAssistant();
    const exerciseAssistant = getExerciseAssistant();
    const explanationAssistant = getExplanationAssistant();
    const evaluationAssistant = getEvaluationAssistant();

    Course.fromHrefAndStorage(href, sessionStorageData)
        .then(async course => {
            if (course) {
                courseAssistant.setCourse(course);
                exerciseAssistant.setCourse(course);
                explanationAssistant.setCourse(course);
                evaluationAssistant.setCourse(course);

                await courseAssistant.loadChatHistory();
                await initializeLabDataIfNeeded(course);

                sendResponse({ success: true, course: course });
                console.log('[background] Curso cargado:', course);
            } else {
                sendResponse({ success: false, error: 'No se pudo cargar el curso' });
                console.error('[background] No se pudo crear el curso desde href y storage');
            }
        })
        .catch(error => {
            console.error('[background] Error al cargar curso:', error);
            sendResponse({ success: false, error: error.message });
        });

    return true;
}

export function handleGetExerciseList(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, resourceId, forceRefresh } = request;
    const exerciseAssistant = getExerciseAssistant();

    console.log(`Identificando ejercicios en página: ${pageId}, recurso: ${resourceId || 'N/A'}, forceRefresh: ${!!forceRefresh}`);

    (async () => {
        try {
            if (!forceRefresh) {
                const cachedData = await ExerciseStorageManager.getExerciseData(pageId);

                if (cachedData) {
                    console.log(`Ejercicios recuperados del storage (${cachedData.exercises.length} ejercicios)`);

                    const exercises = cachedData.exercises.map(
                        (ex: { name: string; statement: string; allowed?: boolean }) =>
                            new Exercise(ex.name, ex.statement, ex.allowed ?? true)
                    );

                    sendResponse({
                        success: true,
                        exercises: exercises,
                        exercise_context: cachedData.exerciseContext,
                        concepts: cachedData.concepts,
                        learning_objectives: cachedData.learningObjectives,
                        fromCache: true
                    });
                    return;
                }
            }

            console.log(forceRefresh ? 'Forzando re-identificación...' : 'No hay datos en cache, llamando al asistente...');
            const result = await exerciseAssistant.identifyExercises(pageId, resourceId);

            console.log('Ejercicios identificados:', result.exercises);
            console.log('Exercise Context presente:', !!result.exerciseContext);
            console.log('Conceptos:', result.concepts);
            console.log('Objetivos de aprendizaje:', result.learningObjectives);

            sendResponse({
                success: true,
                exercises: result.exercises,
                exercise_context: result.exerciseContext,
                concepts: result.concepts,
                learning_objectives: result.learningObjectives,
                fromCache: false
            });
        } catch (error: any) {
            console.error('Error en getExerciseList:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetCachedExplanation(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName } = request;

    console.log(`Recuperando explicación del cache para: ${exerciseName}`);

    (async () => {
        try {
            const cachedExplanation = await ExplanationStorageManager.getExplanation(pageId, exerciseName);

            if (cachedExplanation) {
                console.log(`Explicación recuperada del cache para: ${exerciseName}`);
                sendResponse({ success: true, explanation: cachedExplanation });
            } else {
                sendResponse({ success: false, error: 'No hay explicación guardada para este ejercicio' });
            }
        } catch (error: any) {
            console.error('Error al recuperar explicación del cache:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetExercisesWithExplanations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    console.log(`Obteniendo lista de ejercicios con explicaciones para: ${pageId}`);

    (async () => {
        try {
            const exerciseNames = await ExplanationStorageManager.getExerciseNamesWithExplanations(pageId);
            console.log(`Encontrados ${exerciseNames.length} ejercicios con explicaciones`);
            sendResponse({ success: true, exerciseNames: exerciseNames });
        } catch (error: any) {
            console.error('Error al obtener ejercicios con explicaciones:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetExerciseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    (async () => {
        try {
            const data = await ExerciseStorageManager.getExerciseData(pageId);
            if (data) {
                sendResponse({ success: true, data: data });
            } else {
                sendResponse({ success: false, error: 'No hay datos para esta página' });
            }
        } catch (error: any) {
            console.error('Error al obtener datos de ejercicios:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetLabData(request: any, sendResponse: (response?: any) => void): boolean {
    const { courseId } = request;

    (async () => {
        try {
            const data = await LabStorageManager.getLabData(courseId);
            if (data) {
                sendResponse({ success: true, data: data });
            } else {
                sendResponse({ success: false, error: 'No hay datos de laboratorios para este curso' });
            }
        } catch (error: any) {
            console.error('Error al obtener datos de laboratorios:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetProgressConfig(_request: any, sendResponse: (response?: any) => void): boolean {
    (async () => {
        try {
            const storedConfig = await ProgressConfigStorageManager.getConfig();
            if (storedConfig) {
                const { timestamp, ...config } = storedConfig;
                sendResponse({ success: true, config, timestamp });
            } else {
                const defaultConfig = ProgressConfigStorageManager.getDefaultConfig();
                sendResponse({ success: true, config: defaultConfig, isDefault: true });
            }
        } catch (error: any) {
            console.error("Error al obtener configuración de progreso:", error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetExercisesWithEvaluations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    console.log(`Obteniendo lista de ejercicios con evaluaciones para: ${pageId}`);

    (async () => {
        try {
            const exerciseNames = await EvaluationStorageManager.getExerciseNamesWithEvaluations(pageId);
            console.log(`Encontrados ${exerciseNames.length} ejercicios con evaluaciones`);
            sendResponse({ success: true, exerciseNames: exerciseNames });
        } catch (error: any) {
            console.error('Error al obtener ejercicios con evaluaciones:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleGetEvaluations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName } = request;

    console.log(`Recuperando evaluaciones para: ${exerciseName}`);

    (async () => {
        try {
            const evaluations = await EvaluationStorageManager.getEvaluations(pageId, exerciseName);

            if (evaluations.length > 0) {
                console.log(`Recuperadas ${evaluations.length} evaluaciones para: ${exerciseName}`);
                sendResponse({ success: true, evaluations: evaluations });
            } else {
                sendResponse({ success: false, error: 'No hay evaluaciones guardadas para este ejercicio' });
            }
        } catch (error: any) {
            console.error('Error al recuperar evaluaciones:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

async function initializeLabDataIfNeeded(course: Course): Promise<void> {
    const hasLabData = await LabStorageManager.hasLabData(course.id);

    if (hasLabData) {
        console.log('[background] Ya existen datos de laboratorios para este curso');
        return;
    }

    console.log('[background] Extrayendo laboratorios del curso...');

    const labs: Lab[] = [];
    for (const section of course.sections) {
        const pageResources = section.getResourcesByType('page');
        for (const resource of pageResources) {
            labs.push({
                id: resource.id,
                name: resource.name,
                required: false
            });
        }
    }

    if (labs.length > 0) {
        await LabStorageManager.saveLabData(course.id, labs);
        console.log(`[background] ${labs.length} laboratorios guardados:`, labs);
    } else {
        console.log('[background] No se encontraron laboratorios (recursos tipo "page")');
    }
}
