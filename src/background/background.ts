/// <reference types="chrome"/>

import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";

let course: Course;
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

function processMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {
    switch (request.action) {
        case "updateConfig":
            if (request.config) {
                const { providerKeys, selectedProvider, selectedModel } = request.config;
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

                console.log("Configuración actualizada en background desde options");
                sendResponse({ success: true });
            }
            return false;
        case "getCourseData":
            course = new Course(request.courseData);
            sendResponse(course);
            return true;
        case "getModelList":
            OpenAIService.getModelList().then((list: any) => sendResponse(list));
            return true;
        case "generateSimpleResponse":
            console.log("Generating response for:\n" + request.prompt);
            OpenAIService.generateResponse(request.prompt).then((response: string) => sendResponse(response))
            return true;

        default:
            return false;
    }
}