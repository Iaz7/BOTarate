export interface LabConfigTabState {
    expandedLab: string | null;
    scrollTop: number;
}

export class LabConfigTabStateStorageManager {
    private static readonly STORAGE_KEY = 'lab_config_tab_state';

    static saveState(state: LabConfigTabState): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('[LabConfigTabStateStorageManager] Error saving state:', error);
        }
    }

    static getState(): LabConfigTabState | null {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                return JSON.parse(data) as LabConfigTabState;
            }
            return null;
        } catch (error) {
            console.error('[LabConfigTabStateStorageManager] Error retrieving state:', error);
            return null;
        }
    }

    static clearState(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('[LabConfigTabStateStorageManager] Error clearing state:', error);
        }
    }
}
