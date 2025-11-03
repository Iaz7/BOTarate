/// <reference types="chrome"/>

import { CourseAssistant } from "../util/ai/CourseAssistant";
import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";

const courseAssistant = new CourseAssistant();
let isConfigLoaded = false;

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
            const { pageId } = request;

            console.log(`Identificando ejercicios en página: ${pageId}`);

            courseAssistant.identifyExercises(pageId)
                .then(exercises => {
                    console.log(`Ejercicios identificados:`, exercises);
                    sendResponse({ success: true, exercises: exercises });
                })
                .catch(error => {
                    console.error('Error en getExerciseList:', error);
                    sendResponse({ success: false, error: error.message });
                });

            return true;
        }

        default:
            return false;
    }
}