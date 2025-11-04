/// <reference types="chrome"/>

import { CourseAssistant } from "../util/ai/CourseAssistant";
import { ExerciseAssistant } from "../util/ai/ExerciseAssistant";
import { OpenAIService } from "../util/ai/OpenAIService";
import { SqlTutorAssistant } from "../util/ai/SqlTutorAssistant";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";

let isConfigLoaded = false;

const courseAssistant : CourseAssistant = new CourseAssistant();
const exerciseAssistant : ExerciseAssistant = new ExerciseAssistant();
const sqlTutorAssistant : SqlTutorAssistant = new SqlTutorAssistant();

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

function processMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {
    switch (request.action) {
        case "updateConfig":
            if (request.config) {
                updateConfigFromRequest(request.config);
                console.log("Configuración actualizada en background desde options");
                sendResponse({ success: true });
            }
            return false;
        case "getCourseData": {
            // Nuevo: el content script pasa href y sessionStorage
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
        case "getModelList":
            OpenAIService.getModelList().then((list: any) => sendResponse(list));
            return true;
        case "generateResponse": {
            const { userMessage, resetHistory } = request;

            console.log("Generando respuesta LLM en background...");

            courseAssistant.generateResponse(userMessage, resetHistory)
                .then(finalResponse => sendResponse(finalResponse))
                .catch(error => {
                    console.error('Error en generateResponse:', error);
                    sendResponse(`Error: ${error.message}`);
                });

            return true;
        }
        case "getExerciseList": {
            const { pageId, resourceId } = request;

            console.log(`Identificando ejercicios en página: ${pageId}, recurso: ${resourceId || 'N/A'}`);

            exerciseAssistant.identifyExercises(pageId, resourceId)
                .then(result => {
                    // result: { exercises, dbSchema?, sqlInstructions?, learningObjectives? }
                    console.log(`Ejercicios identificados:`, result.exercises);
                    console.log(`DB Schema presente:`, !!result.dbSchema);
                    console.log(`Instrucciones SQL:`, result.sqlInstructions);
                    console.log(`Objetivos de aprendizaje:`, result.learningObjectives);
                    sendResponse({ 
                        success: true, 
                        exercises: result.exercises, 
                        db_schema: result.dbSchema,
                        sql_instructions: result.sqlInstructions,
                        learning_objectives: result.learningObjectives
                    });
                })
                .catch(error => {
                    console.error('Error en getExerciseList:', error);
                    sendResponse({ success: false, error: error.message });
                });

            return true;
        }

        case "generateExplanation": {
            const { exerciseName, exerciseStatement, db_schema, sql_instructions, learning_objectives } = request;

            console.log(`Generando explicación para ejercicio: ${exerciseName}`);

            sqlTutorAssistant.generateExplanation(exerciseName, exerciseStatement, db_schema, sql_instructions, learning_objectives)
                .then(explanation => {
                    console.log(`Explicación generada:`, explanation);
                    sendResponse({ success: true, explanation: explanation });
                })
                .catch(error => {
                    console.error('Error en generateExplanation:', error);
                    sendResponse({ success: false, error: error.message });
                });

            return true;
        }

        default:
            return false;
    }
}