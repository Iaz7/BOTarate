import { AssistantConfigStorageManager } from "./AssistantConfigStorageManager";
import { ExerciseStorageManager } from "./ExerciseStorageManager";
import { LabStorageManager } from "./LabStorageManager";
import { ProgressConfigStorageManager } from "./ProgressConfigStorageManager";

/**
 * Estructura de datos para la exportación
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
}

/**
 * Resultado de una operación de importación/exportación
 */
export interface ImportExportResult {
    success: boolean;
    message: string;
    itemsProcessed?: number;
}

/**
 * Gestor de importación y exportación de configuraciones
 * Permite guardar y restaurar toda la configuración de la extensión en formato JSON
 */
export class ImportExportManager {
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
     * Obtiene todos los datos del storage para exportarlos
     * @returns Objeto con toda la configuración
     */
    static async getAllStorageData(): Promise<ExportData> {
        // Obtener todos los datos del storage
        const allData = await chrome.storage.local.get(null);

        // Filtrar datos de ejercicios
        const exerciseData = Object.keys(allData)
            .filter(key => key.startsWith("exercise_data_"))
            .map(key => ({
                key: key.replace("exercise_data_", ""),
                data: allData[key],
            }));

        // Filtrar datos de laboratorios
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

        // Obtener configuración de asistentes
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

            // Crear el blob JSON
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });

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
                message: `Configuración exportada correctamente: ${filename}`,
            };
        } catch (error) {
            console.error("[ImportExportManager] Error al exportar configuración:", error);
            return {
                success: false,
                message: `Error al exportar configuración: ${error instanceof Error ? error.message : "Error desconocido"}`,
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

            // Validar formato
            if (!this.validateImportData(data)) {
                return {
                    success: false,
                    message: "Formato de archivo inválido. Asegúrate de usar un archivo exportado correctamente.",
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
                message: `Configuración importada correctamente. ${importedCount} elementos restaurados.`,
                itemsProcessed: importedCount,
            };
        } catch (error) {
            console.error("[ImportExportManager] Error al importar configuración:", error);

            let errorMessage = "Error desconocido";
            if (error instanceof SyntaxError) {
                errorMessage = "El archivo no contiene JSON válido";
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                success: false,
                message: `Error al importar configuración: ${errorMessage}`,
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
                message: "Todos los datos han sido eliminados correctamente. Se recomienda recargar la página.",
            };
        } catch (error) {
            console.error("[ImportExportManager] Error al limpiar datos:", error);
            return {
                success: false,
                message: `Error al limpiar datos: ${error instanceof Error ? error.message : "Error desconocido"}`,
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
