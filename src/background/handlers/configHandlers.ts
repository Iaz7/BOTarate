import { OpenAIService } from "../../util/ai/OpenAIService";
import { ConfigManager } from "../../util/config/ConfigManager";
import { initializeAssistants } from "../context";

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

export function handleUpdateConfig(request: any, sendResponse: (response?: any) => void): boolean {
    if (request.config) {
        updateConfigFromRequest(request.config);
        OpenAIService.loadProviderConfig();
        console.log("Configuración actualizada en background desde options");
        sendResponse({ success: true });
    }
    return false;
}

export function handleReloadAssistantConfig(sendResponse: (response?: any) => void): boolean {
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
    return true;
}

export function handleGetModelList(sendResponse: (response?: any) => void): boolean {
    OpenAIService.getModelList().then((list: any) => sendResponse(list));
    return true;
}
