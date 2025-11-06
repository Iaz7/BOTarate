/**
 * Clase base para gestores de almacenamiento
 * Proporciona funcionalidad común para guardar y recuperar datos usando chrome.storage.local
 * 
 * Las clases hijas deben definir STORAGE_KEY_PREFIX como una propiedad estática
 */
export abstract class BaseStorageManager {
    /**
     * Guarda datos en el storage
     * @param prefix Prefijo de la clave de storage
     * @param key Clave única para los datos
     * @param data Datos a guardar
     */
    protected static async saveData(prefix: string, key: string, data: any): Promise<void> {
        try {
            const storageKey = `${prefix}${key}`;
            const dataWithTimestamp = {
                ...data,
                timestamp: Date.now()
            };

            await chrome.storage.local.set({ [storageKey]: dataWithTimestamp });
            console.log(`[${this.name}] Datos guardados para clave ${key}`);
        } catch (error) {
            console.error(`[${this.name}] Error al guardar datos:`, error);
            throw error;
        }
    }

    /**
     * Recupera datos del storage
     * @param prefix Prefijo de la clave de storage
     * @param key Clave única de los datos
     * @returns Datos recuperados o null si no existen
     */
    protected static async getData<T>(prefix: string, key: string): Promise<(T & { timestamp: number }) | null> {
        try {
            const storageKey = `${prefix}${key}`;
            const result = await chrome.storage.local.get(storageKey);
            const data = result[storageKey];

            if (data) {
                console.log(`[${this.name}] Datos encontrados para clave ${key} (guardados el ${new Date(data.timestamp).toLocaleString()})`);
                return data;
            }

            console.log(`[${this.name}] No hay datos guardados para clave ${key}`);
            return null;
        } catch (error) {
            console.error(`[${this.name}] Error al recuperar datos:`, error);
            return null;
        }
    }

    /**
     * Elimina datos del storage
     * @param prefix Prefijo de la clave de storage
     * @param key Clave única de los datos
     */
    protected static async removeData(prefix: string, key: string): Promise<void> {
        try {
            const storageKey = `${prefix}${key}`;
            await chrome.storage.local.remove(storageKey);
            console.log(`[${this.name}] Datos eliminados para clave ${key}`);
        } catch (error) {
            console.error(`[${this.name}] Error al eliminar datos:`, error);
            throw error;
        }
    }

    /**
     * Limpia todos los datos del storage con este prefijo
     * @param prefix Prefijo de las claves a eliminar
     */
    protected static async clearAllData(prefix: string): Promise<void> {
        try {
            const allData = await chrome.storage.local.get(null);
            const keysToRemove = Object.keys(allData).filter(key =>
                key.startsWith(prefix)
            );

            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                console.log(`[${this.name}] ${keysToRemove.length} entradas eliminadas`);
            }
        } catch (error) {
            console.error(`[${this.name}] Error al limpiar datos:`, error);
            throw error;
        }
    }

    /**
     * Verifica si existen datos para una clave
     * @param prefix Prefijo de la clave de storage
     * @param key Clave única de los datos
     * @returns true si existen datos, false en caso contrario
     */
    protected static async hasData(prefix: string, key: string): Promise<boolean> {
        const data = await this.getData(prefix, key);
        return data !== null;
    }

    /**
     * Obtiene la cantidad de días desde que se guardaron los datos
     * @param prefix Prefijo de la clave de storage
     * @param key Clave única de los datos
     * @returns Días transcurridos o null si no hay datos
     */
    protected static async getDaysSinceLastUpdate(prefix: string, key: string): Promise<number | null> {
        const data = await this.getData(prefix, key);
        if (!data) return null;

        const daysDiff = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
        return daysDiff;
    }
}
