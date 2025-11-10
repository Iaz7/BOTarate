import { AssistantConfig } from '../ai/AssistantConfig';
import { SqlAssistantsConfig } from '../ai/SqlAssistantsConfig';
import { BaseStorageManager } from './BaseStorageManager';

export { AssistantConfigStorageManager };

/**
 * Gestor de almacenamiento para la configuración de asistentes
 * Guarda y carga la configuración personalizada de los asistentes desde chrome.storage
 */
class AssistantConfigStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'assistant_config_';
    private static readonly CONFIG_KEY = 'main';
    private static readonly defaultConfig: AssistantConfig = new SqlAssistantsConfig();
    private static cachedConfig: AssistantConfig | null = null;

    /**
     * Carga la configuración de asistentes desde el storage
     * Si no existe configuración guardada, devuelve la configuración por defecto (SQL)
     */
    static async loadConfig(): Promise<AssistantConfig> {
        try {
            const result = await this.getData<AssistantConfig>(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY);

            if (result) {
                console.log("[AssistantConfigStorageManager] Configuración cargada desde storage");
                // Extraemos solo la configuración, sin el timestamp
                const { timestamp, ...config } = result;
                this.cachedConfig = config as AssistantConfig;
                return this.cachedConfig;
            } else {
                console.log("[AssistantConfigStorageManager] No hay configuración guardada, usando valores por defecto");
                this.cachedConfig = this.defaultConfig;
                return this.defaultConfig;
            }
        } catch (error) {
            console.error("[AssistantConfigStorageManager] Error al cargar configuración:", error);
            return this.defaultConfig;
        }
    }

    /**
     * Guarda la configuración de asistentes en el storage
     */
    static async saveConfig(config: AssistantConfig): Promise<void> {
        await this.saveData(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY, config);
        this.cachedConfig = config;
    }

    /**
     * Restaura la configuración por defecto (SQL)
     */
    static async resetToDefault(): Promise<void> {
        await this.saveConfig(this.defaultConfig);
        console.log("[AssistantConfigStorageManager] Configuración restaurada a valores por defecto");
    }

    /**
     * Obtiene la configuración en caché (sin acceder al storage)
     * Si no hay caché, devuelve la configuración por defecto
     */
    static getCachedConfig(): AssistantConfig {
        return this.cachedConfig || this.defaultConfig;
    }

    /**
     * Obtiene la configuración por defecto
     */
    static getDefaultConfig(): AssistantConfig {
        return this.defaultConfig;
    }

    /**
     * Actualiza una sección específica de la configuración
     */
    static async updateSection(
        section: keyof AssistantConfig,
        data: any
    ): Promise<void> {
        const currentConfig = await this.loadConfig();
        const updatedConfig = {
            ...currentConfig,
            [section]: data
        };
        await this.saveConfig(updatedConfig);
    }

    /**
     * Elimina la configuración guardada
     */
    static async clearConfig(): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY);
        this.cachedConfig = null;
    }
}
