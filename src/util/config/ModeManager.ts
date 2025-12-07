import { AppMode, ModeStorageManager } from "../storage/ModeStorageManager";

// Re-export AppMode to maintain compatibility
export { AppMode };

/**
 * Extension operation mode manager
 * Controls whether the extension is in student or teacher mode
 */
export class ModeManager {
    private static cachedMode: AppMode | null = null;

    /**
     * Gets the current application mode
     * @returns Current mode (default: teacher if user is teacher, student otherwise)
     */
    static async getMode(): Promise<AppMode> {
        if (this.cachedMode) {
            return this.cachedMode;
        }

        try {
            const mode = await ModeStorageManager.getMode();
            this.cachedMode = mode;
            return mode;
        } catch (error) {
            console.error("[ModeManager] Error getting mode:", error);
            return AppMode.STUDENT;
        }
    }

    /**
     * Sets the application mode
     * @param mode Mode to set
     */
    static async setMode(mode: AppMode): Promise<void> {
        try {
            await ModeStorageManager.saveMode(mode);
            this.cachedMode = mode;
            console.log(`[ModeManager] Mode changed to: ${mode}`);
        } catch (error) {
            console.error("[ModeManager] Error setting mode:", error);
            throw error;
        }
    }

    /**
     * Checks if the current mode is teacher
     * @returns true if teacher mode
     */
    static async isTeacherMode(): Promise<boolean> {
        const mode = await this.getMode();
        return mode === AppMode.TEACHER;
    }

    /**
     * Checks if the current mode is student
     * @returns true if student mode
     */
    static async isStudentMode(): Promise<boolean> {
        const mode = await this.getMode();
        return mode === AppMode.STUDENT;
    }

    /**
     * Toggles between student and teacher mode
     * @returns The new mode
     */
    static async toggleMode(): Promise<AppMode> {
        const currentMode = await this.getMode();
        const newMode = currentMode === AppMode.TEACHER ? AppMode.STUDENT : AppMode.TEACHER;
        await this.setMode(newMode);
        return newMode;
    }

    /**
     * Clears the mode cache
     */
    static clearCache(): void {
        this.cachedMode = null;
    }
}
