/// <reference types="chrome"/>

import { initLanguage, setLanguage } from "../i18n/backend";
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
import { handleCheckConfiguration, handleGetModelList, handleReloadAssistantConfig, handleUpdateConfig } from "./handlers/configHandlers";
import {
    handleGenerateLabContext,
    handleGetAccumulatedConcepts,
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
    handleCheckUserRole,
    handleGetLabConfig,
    handleRemoveChallengeExercisesExplanations,
    handleRemoveExerciseData,
    handleSaveChatHistory,
    handleSaveProgressConfig,
    handleUpdateExerciseAllowed,
    handleUpdateExerciseTiquismiqui,
    handleUpdateLabReasoningEffort,
    handleUpdateLabRequired,
    handleUpdateLabVerbosity
} from "./handlers/storageHandlers";

async function loadConfiguration(): Promise<void> {
    await initLanguage();
    await ConfigManager.loadConfig();
    await initializeAssistants();
    OpenAIService.loadProviderConfig();
    markConfigLoaded();
    console.log("Configuration loaded in background script");
}

function startInitialLoad(): void {
    loadConfiguration().catch(error => {
        console.error("Could not load configuration in background:", error);
    });
}

startInitialLoad();

chrome.runtime.onInstalled.addListener(() => {
    console.log("The extension has been installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[REQUEST] " + JSON.stringify(request.action));

    if (!isConfigReady()) {
        loadConfiguration()
            .then(() => processMessage(request, sender, sendResponse))
            .catch(error => {
                console.error("Could not load configuration in background:", error);
                sendResponse({ success: false, error: "Could not load configuration" });
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
        case "updateExerciseTiquismiqui":
            return handleUpdateExerciseTiquismiqui(request, sendResponse);
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
        case "updateLabVerbosity":
            return handleUpdateLabVerbosity(request, sendResponse);
        case "updateLabReasoningEffort":
            return handleUpdateLabReasoningEffort(request, sendResponse);
        case "getLabConfig":
            return handleGetLabConfig(request, sendResponse);
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
        case "checkUserRole":
            return handleCheckUserRole(request, sendResponse);
        case "checkConfiguration":
            return handleCheckConfiguration(request, sendResponse);
        case "generateLabContext":
            return handleGenerateLabContext(request, sendResponse);
        case "getAccumulatedConcepts":
            return handleGetAccumulatedConcepts(request, sendResponse);
        case "setLanguage":
            setLanguage(request.language)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        default:
            return false;
    }
}
