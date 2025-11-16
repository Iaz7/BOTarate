import { BaseStorageManager } from "./BaseStorageManager";

export interface ProgressConfig {
    minScoreToPass: number;
    minChallengesPercentage: number;
}

export class ProgressConfigStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = "progress_config_";
    private static readonly GLOBAL_KEY = "global";

    static getDefaultConfig(): ProgressConfig {
        return {
            minScoreToPass: 5,
            minChallengesPercentage: 100,
        };
    }

    static async saveConfig(config: ProgressConfig): Promise<void> {
        await this.saveData(this.STORAGE_KEY_PREFIX, this.GLOBAL_KEY, config);
    }

    static async getConfig(): Promise<(ProgressConfig & { timestamp: number }) | null> {
        return await this.getData<ProgressConfig>(this.STORAGE_KEY_PREFIX, this.GLOBAL_KEY);
    }

    static async removeConfig(): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, this.GLOBAL_KEY);
    }

    static async clearAll(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }
}
