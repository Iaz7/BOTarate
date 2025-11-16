/// <reference types="chrome"/>

import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { initializeAssistants, isConfigReady, markConfigLoaded } from "./context";
import {
    handleEvaluateSolution,
    handleGenerateExplanation,
    handleGenerateResponse,
    handleInitializeExplanationChat,
    handleLoadChatHistory,
    handleResetChatHistory,
    handleSendExplanationChatMessage
} from "./handlers/assistantHandlers";
import { handleGetModelList, handleReloadAssistantConfig, handleUpdateConfig } from "./handlers/configHandlers";
import {
    handleGetCachedExplanation,
    handleGetCourseData,
    handleGetEvaluations,
    handleGetExerciseData,
    handleGetExerciseList,
    handleGetExercisesWithEvaluations,
    handleGetExercisesWithExplanations,
    handleGetLabData,
    handleGetProgressConfig
} from "./handlers/dataHandlers";
import {
    handleRemoveChallengeExercisesExplanations,
    handleRemoveExerciseData,
    handleSaveChatHistory,
    handleSaveProgressConfig,
    handleUpdateExerciseAllowed,
    handleUpdateLabRequired
} from "./handlers/storageHandlers";

async function loadConfiguration(): Promise<void> {
    await ConfigManager.loadConfig();
    await initializeAssistants();
    OpenAIService.loadProviderConfig();
    markConfigLoaded();
    console.log("Configuración cargada en background script");
}

function startInitialLoad(): void {
    loadConfiguration().catch(error => {
        console.error("No se pudo cargar la configuración en background:", error);
    });
}

startInitialLoad();

chrome.runtime.onInstalled.addListener(() => {
    console.log("La extensión ha sido instalada.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[REQUEST] " + JSON.stringify(request.action));

    if (!isConfigReady()) {
        loadConfiguration()
            .then(() => processMessage(request, sender, sendResponse))
            .catch(error => {
                console.error("No se pudo cargar la configuración en background:", error);
                sendResponse({ success: false, error: "No se pudo cargar la configuración" });
            });
        return true;
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
        case "getProgressConfig":
            return handleGetProgressConfig(request, sendResponse);
        case "updateLabRequired":
            return handleUpdateLabRequired(request, sendResponse);
        case "saveProgressConfig":
            return handleSaveProgressConfig(request, sendResponse);
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
        case "initializeExplanationChat":
            return handleInitializeExplanationChat(request, sendResponse);
        case "sendExplanationChatMessage":
            return handleSendExplanationChatMessage(request, sendResponse);
        case "saveChatHistory":
            return handleSaveChatHistory(request, sendResponse);
        default:
            return false;
    }
}
