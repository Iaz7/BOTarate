/// <reference types="chrome"/>

import { CourseAssistant } from "../util/ai/CourseAssistant";
import { ExerciseAssistant } from "../util/ai/ExerciseAssistant";
import { OpenAIService } from "../util/ai/OpenAIService";
import { SqlTutorAssistant } from "../util/ai/SqlTutorAssistant";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";
import { Exercise } from "../util/egela/Exercise";
import { ExerciseStorageManager } from "../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../util/storage/ExplanationStorageManager";

let isConfigLoaded = false;

const courseAssistant: CourseAssistant = new CourseAssistant();
const exerciseAssistant: ExerciseAssistant = new ExerciseAssistant();
const sqlTutorAssistant: SqlTutorAssistant = new SqlTutorAssistant();

(async () => {
    try {
        await ConfigManager.loadConfig();
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
        case "removeBlockedExercisesExplanations":
            return handleRemoveBlockedExercisesExplanations(request, sendResponse);
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
        console.log("Configuración actualizada en background desde options");
        sendResponse({ success: true });
    }
    return false;
}

function handleGetCourseData(request: any, sendResponse: (response?: any) => void): boolean {
    const { href, sessionStorageData } = request;

    Course.fromHrefAndStorage(href, sessionStorageData)
        .then(course => {
            if (course) {
                courseAssistant.setCourse(course);
                exerciseAssistant.setCourse(course);
                sqlTutorAssistant.setCourse(course);
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
                    db_schema: cachedData.dbSchema,
                    sql_instructions: cachedData.sqlInstructions,
                    learning_objectives: cachedData.learningObjectives,
                    fromCache: true
                });
                return;
            }

            // No hay datos en cache, llamar al asistente
            console.log('No hay datos en cache, llamando al asistente...');
            const result = await exerciseAssistant.identifyExercises(pageId, resourceId);

            console.log(`Ejercicios identificados:`, result.exercises);
            console.log(`DB Schema presente:`, !!result.dbSchema);
            console.log(`Instrucciones SQL:`, result.sqlInstructions);
            console.log(`Objetivos de aprendizaje:`, result.learningObjectives);

            sendResponse({
                success: true,
                exercises: result.exercises,
                db_schema: result.dbSchema,
                sql_instructions: result.sqlInstructions,
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
    const { exerciseName, exerciseStatement, db_schema, sql_instructions, learning_objectives, pageId } = request;

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

            // Siempre generar nueva explicación (no usar cache)
            const explanation = await sqlTutorAssistant.generateExplanation(
                exerciseName,
                exerciseStatement,
                db_schema,
                sql_instructions,
                learning_objectives
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

function handleRemoveBlockedExercisesExplanations(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseNames } = request;

    (async () => {
        try {
            // Eliminar las explicaciones de los ejercicios bloqueados
            for (const exerciseName of exerciseNames) {
                try {
                    await ExplanationStorageManager.removeExplanation(pageId, exerciseName);
                    console.log(`Explicación eliminada para ejercicio bloqueado: ${exerciseName}`);
                } catch (removeError) {
                    // Es normal que no exista explicación para algunos ejercicios
                    console.log(`No había explicación guardada para: ${exerciseName}`, removeError);
                }
            }

            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al eliminar explicaciones de ejercicios bloqueados:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}
