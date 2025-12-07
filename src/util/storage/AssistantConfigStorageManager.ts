import { AssistantConfig } from '../ai/AssistantConfig';
import { SqlAssistantsConfig } from '../ai/SqlAssistantsConfig';
import { BaseStorageManager } from './BaseStorageManager';

export { AssistantConfigStorageManager };

/**
 * Storage manager for assistant configuration
 * Saves and loads custom assistant configuration from chrome.storage
 */
class AssistantConfigStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'assistant_config_';
    private static readonly CONFIG_KEY = 'main';
    private static readonly defaultConfig: AssistantConfig = new SqlAssistantsConfig();
    private static cachedConfig: AssistantConfig | null = null;

    /**
     * Loads assistant configuration from storage
     * If no saved configuration exists, returns default configuration (SQL)
     */
    static async loadConfig(): Promise<AssistantConfig> {
        try {
            const result = await this.getData<AssistantConfig>(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY);

            if (result) {
                console.log("[AssistantConfigStorageManager] Configuration loaded from storage");
                // Extract only the configuration, without the timestamp
                const { timestamp, ...config } = result;
                this.cachedConfig = config as AssistantConfig;
                return this.cachedConfig;
            } else {
                console.log("[AssistantConfigStorageManager] No saved configuration, using default values");
                this.cachedConfig = this.defaultConfig;
                return this.defaultConfig;
            }
        } catch (error) {
            console.error("[AssistantConfigStorageManager] Error loading configuration:", error);
            return this.defaultConfig;
        }
    }

    /**
     * Saves assistant configuration to storage
     */
    static async saveConfig(config: AssistantConfig): Promise<void> {
        await this.saveData(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY, config);
        this.cachedConfig = config;
    }

    /**
     * Restores default configuration (SQL)
     */
    static async resetToDefault(): Promise<void> {
        await this.saveConfig(this.defaultConfig);
        console.log("[AssistantConfigStorageManager] Configuration restored to default values");
    }

    /**
     * Gets cached configuration (without accessing storage)
     * If no cache, returns default configuration
     */
    static getCachedConfig(): AssistantConfig {
        return this.cachedConfig || this.defaultConfig;
    }

    /**
     * Gets default configuration
     */
    static getDefaultConfig(): AssistantConfig {
        return this.defaultConfig;
    }

    /**
     * Updates a specific section of the configuration
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
     * Deletes saved configuration
     */
    static async clearConfig(): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY);
        this.cachedConfig = null;
    }
}
