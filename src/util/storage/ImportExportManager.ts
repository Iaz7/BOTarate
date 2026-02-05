import { AssistantConfigStorageManager } from "./AssistantConfigStorageManager";
import { ExerciseStorageManager } from "./ExerciseStorageManager";
import { LabStorageManager } from "./LabStorageManager";
import { ProgressConfigStorageManager } from "./ProgressConfigStorageManager";

/**
 * Data structure for export
 */
export interface ExportData {
    exportDate: string;
    assistantConfig?: any;
    exerciseData: Array<{
        key: string;
        data: any;
    }>;
    labData: Array<{
        key: string;
        data: any;
    }>;
    progressConfigData: Array<{
        key: string;
        data: any;
    }>;
    signature?: string; // Firma HMAC para verificar integridad
}

/**
 * Result of an import/export operation
 */
export interface ImportExportResult {
    success: boolean;
    message: string;
    itemsProcessed?: number;
}

/**
 * Configuration import and export manager
 * Allows saving and restoring all extension configuration in JSON format
 */
export class ImportExportManager {
    // Clave secreta para firmar las exportaciones (hardcodeada para simplicidad)
    private static readonly SECRET_KEY = "egela-assistant-config-integrity-key-2024";

    /**
     * Genera una firma HMAC-SHA256 del texto dado
     */
    private static async generateHMAC(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(this.SECRET_KEY);
        const textData = encoder.encode(text);

        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signature = await crypto.subtle.sign("HMAC", key, textData);
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }

    /**
     * Verifica una firma HMAC-SHA256
     */
    private static async verifyHMAC(text: string, signature: string): Promise<boolean> {
        const expectedSignature = await this.generateHMAC(text);
        return expectedSignature === signature;
    }
    private static async restoreCollection(
        prefix: string,
        items?: Array<{ key: string; data: any }>
    ): Promise<number> {
        if (!items || items.length === 0) {
            return 0;
        }

        for (const item of items) {
            await chrome.storage.local.set({
                [`${prefix}${item.key}`]: item.data,
            });
        }

        return items.length;
    }

    /**
     * Gets all storage data for export
     * @returns Object with all configuration
     */
    static async getAllStorageData(): Promise<ExportData> {
        // Get all storage data
        const allData = await chrome.storage.local.get(null);

        // Filter exercise data
        const exerciseData = Object.keys(allData)
            .filter(key => key.startsWith("exercise_data_"))
            .map(key => ({
                key: key.replace("exercise_data_", ""),
                data: allData[key],
            }));

        // Filter lab data
        const labData = Object.keys(allData)
            .filter(key => key.startsWith("lab_data_"))
            .map(key => ({
                key: key.replace("lab_data_", ""),
                data: allData[key],
            }));

        const progressConfigData = Object.keys(allData)
            .filter(key => key.startsWith("progress_config_"))
            .map(key => ({
                key: key.replace("progress_config_", ""),
                data: allData[key],
            }));

        // Get assistant configuration
        const assistantConfig = await AssistantConfigStorageManager.loadConfig();

        return {
            exportDate: new Date().toISOString(),
            assistantConfig,
            exerciseData,
            labData,
            progressConfigData,
        };
    }

    /**
     * Exporta la configuración a un archivo JSON y lo descarga
     * @returns Resultado de la operación
     */
    static async exportToFile(): Promise<ImportExportResult> {
        try {
            const data = await this.getAllStorageData();

            // Crear JSON sin firma
            const dataWithoutSignature = { ...data };
            delete dataWithoutSignature.signature;
            const jsonString = JSON.stringify(dataWithoutSignature, null, 2);

            // Generar firma HMAC
            const signature = await this.generateHMAC(jsonString);

            // Añadir firma al objeto
            const signedData = { ...dataWithoutSignature, signature };

            // Crear el blob JSON
            const signedJsonString = JSON.stringify(signedData, null, 2);
            const blob = new Blob([signedJsonString], { type: "application/json" });

            // Crear el nombre del archivo con fecha
            const date = new Date().toISOString().split("T")[0];
            const filename = `egela-assistant-config-${date}.json`;

            // Crear un enlace temporal y descargarlo
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            return {
                success: true,
                message: "success",
            };
        } catch (error) {
            console.error("[ImportExportManager] Error al exportar configuración:", error);
            return {
                success: false,
                message: "export_error",
            };
        }
    }

    /**
     * Valida que el archivo importado tenga el formato correcto
     * @param data Datos importados
     * @returns true si el formato es válido
     */
    private static validateImportData(data: any): data is ExportData {
        if (!data || typeof data !== "object") {
            return false;
        }

        if (!data.exportDate) {
            return false;
        }

        if (!data.signature || typeof data.signature !== "string") {
            return false;
        }

        // Validar que las estructuras de datos existan (pueden estar vacías)
        if (data.exerciseData && !Array.isArray(data.exerciseData)) {
            return false;
        }

        if (data.labData && !Array.isArray(data.labData)) {
            return false;
        }

        return true;
    }

    /**
     * Importa la configuración desde un archivo JSON
     * @param file Archivo JSON a importar
     * @returns Resultado de la operación
     */
    static async importFromFile(file: File): Promise<ImportExportResult> {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validar formato
            if (!this.validateImportData(data)) {
                return {
                    success: false,
                    message: "invalid_format",
                };
            }

            // Verificar firma
            const { signature, ...dataWithoutSignature } = data;
            const jsonString = JSON.stringify(dataWithoutSignature, null, 2);
            const isValidSignature = await this.verifyHMAC(jsonString, signature);

            if (!isValidSignature) {
                return {
                    success: false,
                    message: "invalid_signature",
                };
            }

            let importedCount = 0;

            // Importar configuración de asistentes
            if (data.assistantConfig) {
                await AssistantConfigStorageManager.saveConfig(data.assistantConfig);
                importedCount++;
                console.log("[ImportExportManager] Configuración de asistentes importada");
            }

            importedCount += await this.restoreCollection("exercise_data_", data.exerciseData);
            importedCount += await this.restoreCollection("lab_data_", data.labData);
            importedCount += await this.restoreCollection("progress_config_", data.progressConfigData);

            // Notificar al background script para recargar configuración
            try {
                await chrome.runtime.sendMessage({ action: "reloadAssistantConfig" });
            } catch (error) {
                console.error("[ImportExportManager] Error notificando al background:", error);
            }

            return {
                success: true,
                message: "success",
                itemsProcessed: importedCount,
            };
        } catch (error) {
            console.error("[ImportExportManager] Error al importar configuración:", error);

            let errorMessage = "unknown_error";
            if (error instanceof SyntaxError) {
                errorMessage = "invalid_json";
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                success: false,
                message: errorMessage,
            };
        }
    }

    /**
     * Limpia todos los datos del storage
     * @returns Resultado de la operación
     */
    static async clearAllData(): Promise<ImportExportResult> {
        try {
            await ExerciseStorageManager.clearAllExerciseData();
            await LabStorageManager.clearAllLabData();
            await AssistantConfigStorageManager.clearConfig();
            await ProgressConfigStorageManager.clearAll();

            console.log("[ImportExportManager] Todos los datos han sido eliminados");

            return {
                success: true,
                message: "success",
            };
        } catch (error) {
            console.error("[ImportExportManager] Error al limpiar datos:", error);
            return {
                success: false,
                message: "clear_error",
            };
        }
    }

    /**
     * Obtiene estadísticas sobre los datos almacenados
     * @returns Objeto con las estadísticas
     */
    static async getStorageStats(): Promise<{
        exerciseCount: number;
        labCount: number;
        progressConfigCount: number;
        hasAssistantConfig: boolean;
    }> {
        const allData = await chrome.storage.local.get(null);

        const exerciseCount = Object.keys(allData).filter(key => key.startsWith("exercise_data_")).length;
        const labCount = Object.keys(allData).filter(key => key.startsWith("lab_data_")).length;
        const progressConfigCount = Object.keys(allData).filter(key => key.startsWith("progress_config_")).length;
        const hasAssistantConfig = Object.keys(allData).some(key => key.startsWith("assistant_config_"));

        return {
            exerciseCount,
            labCount,
            progressConfigCount,
            hasAssistantConfig,
        };
    }
}
