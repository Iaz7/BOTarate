import { BaseStorageManager } from "./BaseStorageManager";

export enum AppMode {
    STUDENT = "student",
    TEACHER = "teacher"
}

interface ModeData {
    mode: AppMode;
}

interface UserRoleData {
    isTeacher: boolean;
}

/**
 * Gestor de almacenamiento para el modo de operación y rol del usuario
 */
export class ModeStorageManager extends BaseStorageManager {
    private static readonly MODE_STORAGE_KEY = "app_mode";
    private static readonly USER_ROLE_STORAGE_KEY = "user_role";
    private static readonly USER_ROLE_CACHE_DURATION = 3600000; // 1 hora en milisegundos

    /**
     * Guarda el modo de operación actual
     * @param mode Modo a guardar
     */
    static async saveMode(mode: AppMode): Promise<void> {
        const data: ModeData = { mode };
        await this.saveData("", this.MODE_STORAGE_KEY, data);
    }

    /**
     * Obtiene el modo de operación actual
     * @returns Modo guardado o STUDENT por defecto
     */
    static async getMode(): Promise<AppMode> {
        const data = await this.getData<ModeData>("", this.MODE_STORAGE_KEY);
        return data?.mode || AppMode.STUDENT;
    }

    /**
     * Guarda el rol del usuario con timestamp
     * @param isTeacher true si el usuario es profesor
     */
    static async saveUserRole(isTeacher: boolean): Promise<void> {
        const data: UserRoleData = { isTeacher };
        await this.saveData("", this.USER_ROLE_STORAGE_KEY, data);
    }

    /**
     * Obtiene el rol del usuario si está en caché y es válido
     * @returns Objeto con isTeacher y isValid, o null si no hay caché válido
     */
    static async getUserRole(): Promise<{ isTeacher: boolean; isValid: boolean } | null> {
        const data = await this.getData<UserRoleData>("", this.USER_ROLE_STORAGE_KEY);

        if (!data) {
            return null;
        }

        // Verificar si el caché sigue siendo válido
        const isValid = Date.now() - data.timestamp < this.USER_ROLE_CACHE_DURATION;

        return {
            isTeacher: data.isTeacher,
            isValid
        };
    }

    /**
     * Limpia el caché del rol del usuario
     */
    static async clearUserRoleCache(): Promise<void> {
        await this.removeData("", this.USER_ROLE_STORAGE_KEY);
    }

    /**
     * Limpia todos los datos de modo y rol
     */
    static async clearAll(): Promise<void> {
        await this.removeData("", this.MODE_STORAGE_KEY);
        await this.removeData("", this.USER_ROLE_STORAGE_KEY);
    }
}
