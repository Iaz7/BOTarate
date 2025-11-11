/// <reference types="chrome"/>

import { AssistantConfig } from "../util/ai/AssistantConfig";
import { CourseAssistant } from "../util/ai/CourseAssistant";
import { EvaluationAssistant } from "../util/ai/EvaluationAssistant";
import { ExerciseAssistant } from "../util/ai/ExerciseAssistant";
import { ExplanationAssistant } from "../util/ai/ExplanationAssistant";
import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";
import { Exercise } from "../util/egela/Exercise";
import { AssistantConfigStorageManager } from "../util/storage/AssistantConfigStorageManager";
import { EvaluationStorageManager } from "../util/storage/EvaluationStorageManager";
import { ExerciseStorageManager } from "../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../util/storage/ExplanationStorageManager";
import { Lab, LabStorageManager } from "../util/storage/LabStorageManager";

let isConfigLoaded = false;
let assistantsConfig: AssistantConfig;

// Inicializar asistentes (se crearán cuando se cargue la configuración)
let courseAssistant: CourseAssistant;
let exerciseAssistant: ExerciseAssistant;
let explanationAssistant: ExplanationAssistant;
let evaluationAssistant: EvaluationAssistant;

// Función para inicializar los asistentes con la configuración cargada
async function initializeAssistants() {
    assistantsConfig = await AssistantConfigStorageManager.loadConfig();

    courseAssistant = new CourseAssistant(assistantsConfig);
    exerciseAssistant = new ExerciseAssistant(assistantsConfig);
    explanationAssistant = new ExplanationAssistant(assistantsConfig);
    evaluationAssistant = new EvaluationAssistant(assistantsConfig);

    console.log("Asistentes inicializados con configuración cargada");
}

(async () => {
    try {
        await ConfigManager.loadConfig();
        await initializeAssistants();
        OpenAIService.loadProviderConfig();
        isConfigLoaded = true;
        console.log("Configuración cargada en background script");
    } catch (e) {
        console.error('No se pudo cargar la configuración en background:', e);
    }
})();

chrome.runtime.onInstalled.addListener(() => {
    console.log("La extensión ha sido instalada.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    console.log("[REQUEST] " + JSON.stringify(request.action));

    // Esperar a que la configuración esté cargada antes de procesar mensajes
    if (!isConfigLoaded) {
        ConfigManager.loadConfig().then(() => {
            isConfigLoaded = true;
            processMessage(request, sender, sendResponse);
        });
        return true; // Mantener el canal abierto para la respuesta asíncrona
    }

    return processMessage(request, sender, sendResponse);
});

function processMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {
    switch (request.action) {
        case "updateConfig":
            return handleUpdateConfig(request, sendResponse);
        case "reloadAssistantConfig":
            return handleReloadAssistantConfig(sendResponse);
        case "getCourseData":
            return handleGetCourseData(request, sendResponse);
        case "getModelList":
            return handleGetModelList(sendResponse);
        case "generateResponse":
            return handleGenerateResponse(request, sendResponse);
        case "getExerciseList":
            return handleGetExerciseList(request, sendResponse);
        case "generateExplanation":
            return handleGenerateExplanation(request, sendResponse);
        case "getCachedExplanation":
            return handleGetCachedExplanation(request, sendResponse);
        case "getExercisesWithExplanations":
            return handleGetExercisesWithExplanations(request, sendResponse);
        case "removeExerciseData":
            return handleRemoveExerciseData(request, sendResponse);
        case "updateExerciseAllowed":
            return handleUpdateExerciseAllowed(request, sendResponse);
        case "getExerciseData":
            return handleGetExerciseData(request, sendResponse);
        case "removeChallengeExercisesExplanations":
            return handleRemoveChallengeExercisesExplanations(request, sendResponse);
        case "getLabData":
            return handleGetLabData(request, sendResponse);
        case "updateLabRequired":
            return handleUpdateLabRequired(request, sendResponse);
        case "evaluateSolution":
            return handleEvaluateSolution(request, sendResponse);
        case "getExercisesWithEvaluations":
            return handleGetExercisesWithEvaluations(request, sendResponse);
        case "getEvaluations":
            return handleGetEvaluations(request, sendResponse);
        case "loadChatHistory":
            return handleLoadChatHistory(sendResponse);
        case "resetChatHistory":
            return handleResetChatHistory(sendResponse);
        default:
            return false;
    }
}

function updateConfigFromRequest(config: any): void {
    const { providerKeys, selectedProvider, selectedModel } = config;

    if (providerKeys) {
        for (let index = 0; index < providerKeys.length; index++) {
            ConfigManager.setProviderKey(index, providerKeys[index]);
        }
    }

    if (selectedProvider !== undefined) {
        ConfigManager.selectProvider(selectedProvider);
    }

    if (selectedModel !== undefined) {
        ConfigManager.selectModel(selectedModel);
    }
}

function handleUpdateConfig(request: any, sendResponse: (response?: any) => void): boolean {
    if (request.config) {
        updateConfigFromRequest(request.config);
        OpenAIService.loadProviderConfig();
        console.log("Configuración actualizada en background desde options");
        sendResponse({ success: true });
    }
    return false;
}

function handleReloadAssistantConfig(sendResponse: (response?: any) => void): boolean {
    (async () => {
        try {
            await initializeAssistants();
            console.log("Configuración de asistentes recargada");
            sendResponse({ success: true });
        } catch (error: any) {
            console.error("Error al recargar configuración de asistentes:", error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true; // Mantener el canal abierto para respuesta asíncrona
}

function handleGetCourseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { href, sessionStorageData } = request;

    Course.fromHrefAndStorage(href, sessionStorageData)
        .then(async course => {
            if (course) {
                courseAssistant.setCourse(course);
                exerciseAssistant.setCourse(course);
                explanationAssistant.setCourse(course);
                evaluationAssistant.setCourse(course);

                // Cargar historial de chat para este curso
                await courseAssistant.loadChatHistory();

                // Extraer y guardar laboratorios si no existen ya en el storage
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

async function initializeLabDataIfNeeded(course: Course): Promise<void> {
    const hasLabData = await LabStorageManager.hasLabData(course.id);

    if (hasLabData) {
        console.log('[background] Ya existen datos de laboratorios para este curso');
        return;
    }

    console.log('[background] Extrayendo laboratorios del curso...');

    // Obtener todos los recursos tipo "page" de todas las secciones
    const labs: Lab[] = [];
    for (const section of course.sections) {
        const pageResources = section.getResourcesByType('page');
        for (const resource of pageResources) {
            labs.push({
                id: resource.id,
                name: resource.name,
                required: false // Por defecto, ningún lab es requerido
            });
        }
    }

    // Guardar la lista de laboratorios en el storage
    if (labs.length > 0) {
        await LabStorageManager.saveLabData(course.id, labs);
        console.log(`[background] ${labs.length} laboratorios guardados:`, labs);
    } else {
        console.log('[background] No se encontraron laboratorios (recursos tipo "page")');
    }
}

function handleGetModelList(sendResponse: (response?: any) => void): boolean {
    OpenAIService.getModelList().then((list: any) => sendResponse(list));
    return true;
}

function handleGenerateResponse(request: any, sendResponse: (response?: any) => void): boolean {
    const { userMessage, resetHistory, exercises } = request;

    console.log("Generando respuesta LLM en background...");

    courseAssistant.generateResponse(userMessage, resetHistory, exercises)
        .then(finalResponse => sendResponse(finalResponse))
        .catch(error => {
            console.error('Error en generateResponse:', error);
            sendResponse(`Error: ${error.message}`);
        });

    return true;
}

function handleGetExerciseList(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, resourceId } = request;

    console.log(`Identificando ejercicios en página: ${pageId}, recurso: ${resourceId || 'N/A'}`);

    // Primero intentamos obtener los datos del storage
    (async () => {
        try {
            const cachedData = await ExerciseStorageManager.getExerciseData(pageId);

            if (cachedData) {
                // Datos encontrados en cache
                console.log(`Ejercicios recuperados del storage (${cachedData.exercises.length} ejercicios)`);

                // Convertir los datos a objetos Exercise
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

            // No hay datos en cache, llamar al asistente
            console.log('No hay datos en cache, llamando al asistente...');
            const result = await exerciseAssistant.identifyExercises(pageId, resourceId);

            console.log(`Ejercicios identificados:`, result.exercises);
            console.log(`Exercise Context presente:`, !!result.exerciseContext);
            console.log(`Conceptos:`, result.concepts);
            console.log(`Objetivos de aprendizaje:`, result.learningObjectives);

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

function handleGenerateExplanation(request: any, sendResponse: (response?: any) => void): boolean {
    const { exerciseName, exerciseStatement, exercise_context, concepts, learning_objectives, pageId, courseId } = request;

    console.log(`Generando explicación para ejercicio: ${exerciseName}`);

    (async () => {
        try {
            // Verificar si el ejercicio está bloqueado antes de generar la explicación
            if (pageId) {
                const exerciseData = await ExerciseStorageManager.getExerciseData(pageId);
                if (exerciseData) {
                    const exercise = exerciseData.exercises.find(ex => ex.name === exerciseName);
                    if (exercise?.allowed === false) {
                        console.log(`Intento de explicar ejercicio bloqueado: ${exerciseName}`);
                        sendResponse({
                            success: false,
                            error: `El ejercicio "${exerciseName}" está bloqueado y no puede ser explicado.`
                        });
                        return;
                    }
                }
            }

            // Obtener el resumen de progreso si hay courseId
            let progressSummary = undefined;
            if (courseId) {
                // Obtener la lista de laboratorios
                const labData = await LabStorageManager.getLabData(courseId);

                if (labData?.labs) {
                    const requiredLabs = labData.labs.filter(lab => lab.required);

                    if (requiredLabs.length > 0) {
                        const completedLabs: string[] = [];
                        const completedExercises: Map<string, string[]> = new Map();

                        // Para cada laboratorio requerido, obtener ejercicios y evaluaciones
                        for (const lab of requiredLabs) {
                            // Obtener ejercicios del laboratorio
                            const exerciseData = await ExerciseStorageManager.getExerciseData(lab.id);

                            if (exerciseData) {
                                const challengeExercises = exerciseData.exercises.filter((ex: any) => ex.allowed === false);

                                if (challengeExercises.length > 0) {
                                    let allCompleted = true;
                                    const completedInLab: string[] = [];

                                    for (const exercise of challengeExercises) {
                                        const evaluations = await EvaluationStorageManager.getEvaluations(lab.id, exercise.name);

                                        if (!evaluations || evaluations.length === 0) {
                                            allCompleted = false;
                                        } else {
                                            const bestScore = Math.max(...evaluations.map((e: any) => e.score));
                                            if (bestScore >= 5) {
                                                completedInLab.push(exercise.name);
                                            } else {
                                                allCompleted = false;
                                            }
                                        }
                                    }

                                    // Si completó todos los ejercicios de reto, el lab está completado
                                    if (allCompleted) {
                                        completedLabs.push(lab.name);
                                    }

                                    if (completedInLab.length > 0) {
                                        completedExercises.set(lab.name, completedInLab);
                                    }
                                }
                                // Si no hay ejercicios de reto (challengeExercises.length === 0), no se cuenta como completado
                            }
                        }

                        // Construir resumen
                        let summary = "";

                        if (completedLabs.length === 0 && completedExercises.size === 0) {
                            summary += "El alumno aún no ha completado ningún laboratorio ni ejercicio.\n";
                        } else {
                            if (completedLabs.length > 0) {
                                summary += `- Laboratorios completados: ${completedLabs.join(', ')}\n`;
                            }

                            if (completedExercises.size > 0) {
                                summary += "- Ejercicios completados por laboratorio:\n";
                                for (const [labName, exercises] of completedExercises) {
                                    summary += `  * ${labName}: ${exercises.join(', ')}\n`;
                                }
                            }
                        }

                        progressSummary = summary;
                        console.log(`Resumen de progreso generado para la explicación`);
                    }
                }
            }

            // Generar nueva explicación con el resumen de progreso
            const explanation = await explanationAssistant.generateExplanation(
                exerciseName,
                exerciseStatement,
                exercise_context,
                concepts,
                learning_objectives,
                progressSummary
            );

            console.log(`Explicación generada:`, explanation);

            // Guardar en cache si se proporciona pageId
            if (pageId) {
                await ExplanationStorageManager.saveExplanation(pageId, exerciseName, explanation);
                console.log(`Explicación guardada en cache para: ${exerciseName}`);
            }

            sendResponse({ success: true, explanation: explanation });
        } catch (error: any) {
            console.error('Error en generateExplanation:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

function handleGetCachedExplanation(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleGetExercisesWithExplanations(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleRemoveExerciseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId } = request;

    (async () => {
        try {
            // Eliminar tanto los datos de ejercicios como las explicaciones
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

function handleUpdateExerciseAllowed(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleGetExerciseData(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleRemoveChallengeExercisesExplanations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseNames } = request;

    (async () => {
        try {
            // Eliminar las explicaciones de los ejercicios de reto
            for (const exerciseName of exerciseNames) {
                try {
                    await ExplanationStorageManager.removeExplanation(pageId, exerciseName);
                    console.log(`Explicación eliminada para ejercicio de reto: ${exerciseName}`);
                } catch (removeError) {
                    // Es normal que no exista explicación para algunos ejercicios
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

function handleGetLabData(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleUpdateLabRequired(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleEvaluateSolution(request: any, sendResponse: (response?: any) => void): boolean {
    const { exerciseName, exerciseStatement, studentSolution, exercise_context, concepts, learning_objectives, pageId } = request;

    console.log(`Evaluando solución para ejercicio: ${exerciseName}`);

    (async () => {
        try {
            const evaluation = await evaluationAssistant.evaluateSolution(
                exerciseName,
                exerciseStatement,
                studentSolution,
                exercise_context,
                concepts,
                learning_objectives
            );

            console.log(`Solución evaluada con puntuación: ${evaluation.score}/10`);

            // Guardar la evaluación en el storage si se proporciona pageId
            if (pageId) {
                await EvaluationStorageManager.saveEvaluation(
                    pageId,
                    exerciseName,
                    studentSolution,
                    evaluation
                );
                console.log(`Evaluación guardada en storage para: ${exerciseName}`);
            }

            sendResponse({ success: true, evaluation: evaluation });
        } catch (error: any) {
            console.error('Error en evaluateSolution:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

function handleGetExercisesWithEvaluations(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleGetEvaluations(request: any, sendResponse: (response?: any) => void): boolean {
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

function handleLoadChatHistory(sendResponse: (response?: any) => void): boolean {
    console.log('Cargando historial de chat...');

    (async () => {
        try {
            const messages = await courseAssistant.loadChatHistory();
            sendResponse({ success: true, messages });
        } catch (error: any) {
            console.error('Error al cargar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

function handleResetChatHistory(sendResponse: (response?: any) => void): boolean {
    console.log('Reiniciando historial de chat...');

    (async () => {
        try {
            await courseAssistant.resetChatHistory();
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al reiniciar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}
