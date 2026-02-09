import { AgentConfigStorageManager } from "./AgentConfigStorageManager";
import { ExerciseStorageManager } from "./ExerciseStorageManager";
import { LabStorageManager } from "./LabStorageManager";
import { ProgressConfigStorageManager } from "./ProgressConfigStorageManager";

/**
 * Data structure for export
 */
export interface ExportData {
    exportDate: string;
    agentConfig?: any;
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
    // Clave secreta para cifrar las exportaciones (hardcodeada para simplicidad)
    // NOTA: hardcodear la clave hace que el cifrado sea trivialmente reversible si alguien tiene acceso al código.
    private static readonly SECRET_KEY = "egela-agent-config-encryption-key-2024";

    private static async getAesKey(): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = encoder.encode(this.SECRET_KEY);
        const keyHash = await crypto.subtle.digest("SHA-256", keyMaterial);
        return await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    }

    /**
     * Cifra un texto con AES-GCM y devuelve un base64 con IV + ciphertext
     */
    private static async encryptString(plain: string): Promise<string> {
        const key = await this.getAesKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
        const combined = new Uint8Array(iv.length + cipher.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(cipher), iv.length);
        return btoa(String.fromCharCode(...combined));
    }

    /**
     * Descifra un base64 (IV + ciphertext) y devuelve el texto plano
     */
    private static async decryptString(encB64: string): Promise<string> {
        const combined = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);
        const key = await this.getAesKey();
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        return new TextDecoder().decode(plain);
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

        // Get agent configuration
        const agentConfig = await AgentConfigStorageManager.loadConfig();

        return {
            exportDate: new Date().toISOString(),
            agentConfig,
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
            // Crear JSON plano con la configuración
            const plaintext = JSON.stringify(data, null, 2);

            // Cifrar todo el JSON
            const encrypted = await this.encryptString(plaintext);

            // Exportar únicamente el blob cifrado (en la propiedad "signature" para mantener compatibilidad mínima)
            const exportObject = { signature: encrypted };
            const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });

            // Crear el nombre del archivo con fecha
            const date = new Date().toISOString().split("T")[0];
            const filename = `egela-agent-config-${date}.json`;

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

            // El archivo exportado debe contener sólo la propiedad "signature" (blob cifrado)
            if (!data || typeof data !== "object" || !data.signature || typeof data.signature !== "string") {
                return {
                    success: false,
                    message: "invalid_format",
                };
            }

            // Descifrar el blob y parsear el JSON original
            let parsedData: any;
            try {
                const decrypted = await this.decryptString(data.signature);
                parsedData = JSON.parse(decrypted);
            } catch (err) {
                return {
                    success: false,
                    message: "invalid_signature",
                };
            }

            // Validar la estructura del JSON descifrado
            if (!this.validateImportData(parsedData)) {
                return {
                    success: false,
                    message: "invalid_format",
                };
            }

            let importedCount = 0;

            // Importar configuración de agentes
            if (parsedData.agentConfig) {
                await AgentConfigStorageManager.saveConfig(parsedData.agentConfig);
                importedCount++;
                console.log("[ImportExportManager] Configuración de agentes importada");
            }

            importedCount += await this.restoreCollection("exercise_data_", parsedData.exerciseData);
            importedCount += await this.restoreCollection("lab_data_", parsedData.labData);
            importedCount += await this.restoreCollection("progress_config_", parsedData.progressConfigData);

            // Notificar al background script para recargar configuración
            try {
                await chrome.runtime.sendMessage({ action: "reloadAgentConfig" });
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
            await AgentConfigStorageManager.clearConfig();
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
        hasAgentConfig: boolean;
    }> {
        const allData = await chrome.storage.local.get(null);

        const exerciseCount = Object.keys(allData).filter(key => key.startsWith("exercise_data_")).length;
        const labCount = Object.keys(allData).filter(key => key.startsWith("lab_data_")).length;
        const progressConfigCount = Object.keys(allData).filter(key => key.startsWith("progress_config_")).length;
        const hasAgentConfig = Object.keys(allData).some(key => key.startsWith("agent_config_"));

        return {
            exerciseCount,
            labCount,
            progressConfigCount,
            hasAgentConfig,
        };
    }
}
