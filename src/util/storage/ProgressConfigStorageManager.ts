import { BaseStorageManager } from "./BaseStorageManager";

export interface ProgressConfig {
    minScoreToPass: number;
    minChallengesPercentage: number;
}

export class ProgressConfigStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = "progress_config_";
    private static readonly LEGACY_GLOBAL_KEY = "global";

    static getDefaultConfig(): ProgressConfig {
        return {
            minScoreToPass: 5,
            minChallengesPercentage: 100,
        };
    }

    /**
     * Saves progress config for a specific course.
     * @param config The config to save
     * @param courseId Optional course ID. Falls back to legacy 'global' key.
     */
    static async saveConfig(config: ProgressConfig, courseId?: string): Promise<void> {
        const key = courseId || this.LEGACY_GLOBAL_KEY;
        await this.saveData(this.STORAGE_KEY_PREFIX, key, config);
    }

    /**
     * Gets progress config for a specific course.
     * Falls back to legacy 'global' key if no course-specific config.
     * @param courseId Optional course ID.
     */
    static async getConfig(courseId?: string): Promise<(ProgressConfig & { timestamp: number }) | null> {
        const key = courseId || this.LEGACY_GLOBAL_KEY;
        const result = await this.getData<ProgressConfig>(this.STORAGE_KEY_PREFIX, key);
        if (result) return result;

        // If courseId was given but not found, try legacy global
        if (courseId) {
            return await this.getData<ProgressConfig>(this.STORAGE_KEY_PREFIX, this.LEGACY_GLOBAL_KEY);
        }
        return null;
    }

    static async removeConfig(courseId?: string): Promise<void> {
        const key = courseId || this.LEGACY_GLOBAL_KEY;
        await this.removeData(this.STORAGE_KEY_PREFIX, key);
    }

    static async clearAll(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }
}
