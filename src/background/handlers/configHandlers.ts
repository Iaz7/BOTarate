import { OpenAIService } from "../../util/ai/OpenAIService";
import { ConfigManager } from "../../util/config/ConfigManager";
import { initializeAssistants } from "../context";

function updateConfigFromRequest(config: any): void {
    const { providerKeys, selectedProvider, selectedModel, selectedVisionModel } = config;

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

    if (selectedVisionModel !== undefined) {
        ConfigManager.selectVisionModel(selectedVisionModel);
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

export function handleCheckConfiguration(request: any, sendResponse: (response?: any) => void): boolean {
    (async () => {
        try {
            const allData = await chrome.storage.local.get(null);

            // Verificar configuración del LLM
            const configData = allData["config"];
            const hasLLMConfig =
                configData &&
                configData.providerKeys &&
                configData.providerKeys.length > 0 &&
                configData.providerKeys[configData.selectedProvider || 0] &&
                configData.providerKeys[configData.selectedProvider || 0].trim() !== "" &&
                configData.selectedModel &&
                configData.selectedModel.trim() !== "";

            // Verificar configuración de asistentes y datos
            const hasAssistantConfig = Object.keys(allData).some(key => key.startsWith("assistant_config_"));
            const hasExerciseData = Object.keys(allData).some(key => key.startsWith("exercise_data_"));
            const hasLabData = Object.keys(allData).some(key => key.startsWith("lab_data_"));
            const hasStudentConfig = hasAssistantConfig && (hasExerciseData || hasLabData);

            sendResponse({
                success: true,
                hasLLMConfig,
                hasStudentConfig
            });
        } catch (error: any) {
            console.error("Error al verificar configuración:", error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
}
