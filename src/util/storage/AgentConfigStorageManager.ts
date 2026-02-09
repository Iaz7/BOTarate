import { AgentConfig } from '../ai/AgentConfig';
import { BaseStorageManager } from './BaseStorageManager';

export { AgentConfigStorageManager };

/**
 * Storage manager for agent configuration
 * Saves and loads custom agent configuration from chrome.storage
 */
class AgentConfigStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'agent_config_';
    private static readonly LEGACY_CONFIG_KEY = 'main';
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
            courseName: "",
            platformName: "",
            institutionName: "",
            teacherName: "",
            teacherTics: ""
        }
    };
    private static cachedConfig: AgentConfig | null = null;

    /**
     * Loads agent configuration from storage for a specific course.
     * Falls back to legacy 'main' key if no course-specific config exists.
     * @param courseId Optional course ID. If omitted, loads legacy 'main' config.
     */
    static async loadConfig(courseId?: string): Promise<AgentConfig> {
        try {
            const key = courseId || this.LEGACY_CONFIG_KEY;
            const result = await this.getData<AgentConfig>(this.STORAGE_KEY_PREFIX, key);

            if (result) {
                console.log(`[AgentConfigStorageManager] Configuration loaded for key: ${key}`);
                const { timestamp, ...config } = result;
                this.cachedConfig = config as AgentConfig;
                return this.cachedConfig;
            }

            // If courseId was specified but no config found, try legacy key
            if (courseId) {
                const legacyResult = await this.getData<AgentConfig>(this.STORAGE_KEY_PREFIX, this.LEGACY_CONFIG_KEY);
                if (legacyResult) {
                    console.log(`[AgentConfigStorageManager] No config for course ${courseId}, using legacy config`);
                    const { timestamp, ...config } = legacyResult;
                    this.cachedConfig = config as AgentConfig;
                    return this.cachedConfig;
                }
            }

            console.log("[AgentConfigStorageManager] No saved configuration, using default values");
            this.cachedConfig = this.defaultConfig;
            return this.defaultConfig;
        } catch (error) {
            console.error("[AgentConfigStorageManager] Error loading configuration:", error);
            return this.defaultConfig;
        }
    }

    /**
     * Saves agent configuration to storage for a specific course.
     * @param config The agent configuration to save
     * @param courseId Optional course ID. If omitted, saves to legacy 'main' key.
     */
    static async saveConfig(config: AgentConfig, courseId?: string): Promise<void> {
        const key = courseId || this.LEGACY_CONFIG_KEY;
        await this.saveData(this.STORAGE_KEY_PREFIX, key, config);
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
     * @param section The section to update
     * @param data The new data for the section
     * @param courseId Optional course ID
     */
    static async updateSection(
        section: keyof AgentConfig,
        data: any,
        courseId?: string
    ): Promise<void> {
        const currentConfig = await this.loadConfig(courseId);
        const updatedConfig = {
            ...currentConfig,
            [section]: data
        };
        await this.saveConfig(updatedConfig, courseId);
    }

    /**
     * Deletes saved configuration for a specific course or the legacy key.
     * @param courseId Optional course ID. If omitted, clears legacy 'main' config.
     */
    static async clearConfig(courseId?: string): Promise<void> {
        const key = courseId || this.LEGACY_CONFIG_KEY;
        await this.removeData(this.STORAGE_KEY_PREFIX, key);
        this.cachedConfig = null;
    }

    /**
     * Checks if a course-specific configuration exists.
     * @param courseId The course ID to check
     */
    static async hasConfigForCourse(courseId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, courseId);
    }
}