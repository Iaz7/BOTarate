/**
 * Modos de operación de la extensión
 */
export enum AppMode {
    STUDENT = "student",
    TEACHER = "teacher"
}

/**
 * Gestor del modo de operación de la extensión
 * Controla si la extensión está en modo alumno o profesor
 */
export class ModeManager {
    private static readonly STORAGE_KEY = "app_mode";
    private static cachedMode: AppMode | null = null;

    /**
     * Obtiene el modo actual de la aplicación
     * @returns Modo actual (por defecto: alumno)
     */
    static async getMode(): Promise<AppMode> {
        if (this.cachedMode) {
            return this.cachedMode;
        }

        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            const mode = result[this.STORAGE_KEY] as AppMode | undefined;
            this.cachedMode = mode || AppMode.STUDENT;
            return this.cachedMode;
        } catch (error) {
            console.error("[ModeManager] Error al obtener el modo:", error);
            return AppMode.STUDENT;
        }
    }

    /**
     * Establece el modo de la aplicación
     * @param mode Modo a establecer
     */
    static async setMode(mode: AppMode): Promise<void> {
        try {
            await chrome.storage.local.set({ [this.STORAGE_KEY]: mode });
            this.cachedMode = mode;
            console.log(`[ModeManager] Modo cambiado a: ${mode}`);
        } catch (error) {
            console.error("[ModeManager] Error al establecer el modo:", error);
            throw error;
        }
    }

    /**
     * Verifica si el modo actual es profesor
     * @returns true si es modo profesor
     */
    static async isTeacherMode(): Promise<boolean> {
        const mode = await this.getMode();
        return mode === AppMode.TEACHER;
    }

    /**
     * Verifica si el modo actual es alumno
     * @returns true si es modo alumno
     */
    static async isStudentMode(): Promise<boolean> {
        const mode = await this.getMode();
        return mode === AppMode.STUDENT;
    }

    /**
     * Alterna entre modo alumno y profesor
     * @returns El nuevo modo
     */
    static async toggleMode(): Promise<AppMode> {
        const currentMode = await this.getMode();
        const newMode = currentMode === AppMode.TEACHER ? AppMode.STUDENT : AppMode.TEACHER;
        await this.setMode(newMode);
        return newMode;
    }

    /**
     * Limpia el caché del modo
     */
    static clearCache(): void {
        this.cachedMode = null;
    }
}
