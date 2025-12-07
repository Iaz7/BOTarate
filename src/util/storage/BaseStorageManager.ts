/**
 * Base class for storage managers
 * Provides common functionality to save and retrieve data using chrome.storage.local
 * 
 * Child classes must define STORAGE_KEY_PREFIX as a static property
 */
export abstract class BaseStorageManager {
    /**
     * Saves data to storage
     * @param prefix Storage key prefix
     * @param key Unique key for the data
     * @param data Data to save
     */
    protected static async saveData(prefix: string, key: string, data: any): Promise<void> {
        try {
            const storageKey = `${prefix}${key}`;
            const dataWithTimestamp = {
                ...data,
                timestamp: Date.now()
            };

            await chrome.storage.local.set({ [storageKey]: dataWithTimestamp });
            console.log(`[${this.name}] Data saved for key ${key}`);
        } catch (error) {
            console.error(`[${this.name}] Error saving data:`, error);
            throw error;
        }
    }

    /**
     * Retrieves data from storage
     * @param prefix Storage key prefix
     * @param key Unique key for the data
     * @returns Retrieved data or null if not exists
     */
    protected static async getData<T>(prefix: string, key: string): Promise<(T & { timestamp: number }) | null> {
        try {
            const storageKey = `${prefix}${key}`;
            const result = await chrome.storage.local.get(storageKey);
            const data = result[storageKey];

            if (data) {
                console.log(`[${this.name}] Data found for key ${key} (saved on ${new Date(data.timestamp).toLocaleString()})`);
                return data;
            }

            console.log(`[${this.name}] No saved data for key ${key}`);
            return null;
        } catch (error) {
            console.error(`[${this.name}] Error retrieving data:`, error);
            return null;
        }
    }

    /**
     * Deletes data from storage
     * @param prefix Storage key prefix
     * @param key Unique key for the data
     */
    protected static async removeData(prefix: string, key: string): Promise<void> {
        try {
            const storageKey = `${prefix}${key}`;
            await chrome.storage.local.remove(storageKey);
            console.log(`[${this.name}] Data deleted for key ${key}`);
        } catch (error) {
            console.error(`[${this.name}] Error deleting data:`, error);
            throw error;
        }
    }

    /**
     * Clears all data from storage with this prefix
     * @param prefix Prefix of keys to delete
     */
    protected static async clearAllData(prefix: string): Promise<void> {
        try {
            const allData = await chrome.storage.local.get(null);
            const keysToRemove = Object.keys(allData).filter(key =>
                key.startsWith(prefix)
            );

            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                console.log(`[${this.name}] ${keysToRemove.length} entries deleted`);
            }
        } catch (error) {
            console.error(`[${this.name}] Error clearing data:`, error);
            throw error;
        }
    }

    /**
     * Checks if data exists for a key
     * @param prefix Storage key prefix
     * @param key Unique key for the data
     * @returns true if data exists, false otherwise
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
