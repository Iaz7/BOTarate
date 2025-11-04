/**
 * Estructura de datos almacenados para una página
 */
interface ExerciseData {
    pageId: string;
    exercises: Array<{ name: string; statement: string }>;
    dbSchema?: string;
    sqlInstructions?: string[];
    learningObjectives?: string;
    timestamp: number; // Para saber cuándo se guardó
}

/**
 * Gestor de almacenamiento para respuestas del asistente de ejercicios
 * Guarda y recupera las respuestas del ExerciseAssistant usando chrome.storage.local
 */
export class AssistantStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'exercise_data_';

    /**
     * Guarda los datos de ejercicios de una página en el storage
     * @param pageId ID de la página
     * @param exercises Lista de ejercicios
     * @param dbSchema Esquema de BD opcional
     * @param sqlInstructions Instrucciones SQL opcionales
     * @param learningObjectives Objetivos de aprendizaje opcionales
     */
    static async saveExerciseData(
        pageId: string,
        exercises: Array<{ name: string; statement: string }>,
        dbSchema?: string,
        sqlInstructions?: string[],
        learningObjectives?: string
    ): Promise<void> {
        try {
            const key = this.getStorageKey(pageId);
            const data: ExerciseData = {
                pageId,
                exercises,
                dbSchema,
                sqlInstructions,
                learningObjectives,
                timestamp: Date.now()
            };

            await chrome.storage.local.set({ [key]: data });
            console.log(`[AssistantStorageManager] Datos guardados para página ${pageId}`);
        } catch (error) {
            console.error('[AssistantStorageManager] Error al guardar datos:', error);
            throw error;
        }
    }

    /**
     * Recupera los datos de ejercicios de una página del storage
     * @param pageId ID de la página
     * @returns Datos de ejercicios o null si no existen
     */
    static async getExerciseData(
        pageId: string
    ): Promise<{
        exercises: Array<{ name: string; statement: string }>;
        dbSchema?: string;
        sqlInstructions?: string[];
        learningObjectives?: string;
        timestamp: number;
    } | null> {
        try {
            const key = this.getStorageKey(pageId);
            const result = await chrome.storage.local.get(key);
            const data = result[key] as ExerciseData | undefined;

            if (data) {
                console.log(`[AssistantStorageManager] Datos encontrados para página ${pageId} (guardados el ${new Date(data.timestamp).toLocaleString()})`);
                return data;
            }

            console.log(`[AssistantStorageManager] No hay datos guardados para página ${pageId}`);
            return null;
        } catch (error) {
            console.error('[AssistantStorageManager] Error al recuperar datos:', error);
            return null;
        }
    }

    /**
     * Elimina los datos de ejercicios de una página del storage
     * @param pageId ID de la página
     */
    static async removeExerciseData(pageId: string): Promise<void> {
        try {
            const key = this.getStorageKey(pageId);
            await chrome.storage.local.remove(key);
            console.log(`[AssistantStorageManager] Datos eliminados para página ${pageId}`);
        } catch (error) {
            console.error('[AssistantStorageManager] Error al eliminar datos:', error);
            throw error;
        }
    }

    /**
     * Limpia todos los datos de ejercicios almacenados
     */
    static async clearAllExerciseData(): Promise<void> {
        try {
            const allData = await chrome.storage.local.get(null);
            const keysToRemove = Object.keys(allData).filter(key => 
                key.startsWith(this.STORAGE_KEY_PREFIX)
            );

            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                console.log(`[AssistantStorageManager] ${keysToRemove.length} entradas de ejercicios eliminadas`);
            }
        } catch (error) {
            console.error('[AssistantStorageManager] Error al limpiar datos:', error);
            throw error;
        }
    }

    /**
     * Verifica si existen datos guardados para una página
     * @param pageId ID de la página
     * @returns true si existen datos, false en caso contrario
     */
    static async hasExerciseData(pageId: string): Promise<boolean> {
        const data = await this.getExerciseData(pageId);
        return data !== null;
    }

    /**
     * Obtiene la cantidad de días desde que se guardaron los datos
     * @param pageId ID de la página
     * @returns Días transcurridos o null si no hay datos
     */
    static async getDaysSinceLastUpdate(pageId: string): Promise<number | null> {
        const data = await this.getExerciseData(pageId);
        if (!data) return null;

        const daysDiff = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
        return daysDiff;
    }

    /**
     * Genera la clave de almacenamiento para una página
     * @param pageId ID de la página
     * @returns Clave de storage
     */
    private static getStorageKey(pageId: string): string {
        return `${this.STORAGE_KEY_PREFIX}${pageId}`;
    }
}
