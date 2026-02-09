import { AgentConfig } from '../ai/AgentConfig';
import { BaseStorageManager } from './BaseStorageManager';

export { AgentConfigStorageManager };

/**
 * Storage manager for agent configuration
 * Saves and loads custom agent configuration from chrome.storage
 */
class AgentConfigStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'agent_config_';
    private static readonly CONFIG_KEY = 'main';
    private static readonly defaultConfig: AgentConfig = {
        exerciseAgent: {
            role: "",
            contextDescription: "",
            conceptsFieldDescription: "",
            conceptsExamples: "",
            exerciseCriteria: "",
            learningObjectivesGuidance: ""
        },
        evaluationAgent: {
            role: "",
            taskDescription: "",
            evaluationCriteria: "",
            scoringScale: "",
            feedbackFormat: "",
            importantNotes: ""
        },
        explanationAgent: {
            role: "",
            taskDescription: "",
            methodology: "",
            outputFormat: "",
            additionalRules: "",
            importantNotes: "",
            pickyExerciseConfiguration: ""
        },
        common: {
            subjectName: "",
            platformName: "",
            institutionName: "",
            teacherName: "",
            teacherTics: ""
        }
    };
    private static cachedConfig: AgentConfig | null = null;

    /**
     * Loads agent configuration from storage
     * If no saved configuration exists, returns default configuration (SQL)
     */
    static async loadConfig(): Promise<AgentConfig> {
        try {
            const result = await this.getData<AgentConfig>(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY);

            if (result) {
                console.log("[AgentConfigStorageManager] Configuration loaded from storage");
                // Extract only the configuration, without the timestamp
                const { timestamp, ...config } = result;
                this.cachedConfig = config as AgentConfig;
                return this.cachedConfig;
            } else {
                console.log("[AgentConfigStorageManager] No saved configuration, using default values");
                this.cachedConfig = this.defaultConfig;
                return this.defaultConfig;
            }
        } catch (error) {
            console.error("[AgentConfigStorageManager] Error loading configuration:", error);
            return this.defaultConfig;
        }
    }

    /**
     * Saves agent configuration to storage
     */
    static async saveConfig(config: AgentConfig): Promise<void> {
        await this.saveData(this.STORAGE_KEY_PREFIX, this.CONFIG_KEY, config);
        this.cachedConfig = config;
    }

    /**
     * Gets cached configuration (without accessing storage)
     * If no cache, returns default configuration
     */
    static getCachedConfig(): AgentConfig {
        return this.cachedConfig || this.defaultConfig;
    }

    /**
     * Gets default configuration
     */
    static getDefaultConfig(): AgentConfig {
        return this.defaultConfig;
    }

    /**
     * Updates a specific section of the configuration
     */
    static async updateSection(
        section: keyof AgentConfig,
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