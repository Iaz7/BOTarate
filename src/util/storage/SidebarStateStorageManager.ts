export { SidebarStateStorageManager };

interface SidebarState {
    isCollapsed: boolean;
    activeTab: "chat" | "exercises" | "config" | "labs" | "progress";
}

/**
 * Gestor de almacenamiento para el estado del sidebar usando localStorage
 */
class SidebarStateStorageManager {
    private static readonly STORAGE_KEY = 'sidebar_state';

    /**
     * Guarda el estado del sidebar
     */
    static saveSidebarState(state: SidebarState): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            console.log('[SidebarStateStorageManager] Estado guardado');
        } catch (error) {
            console.error('[SidebarStateStorageManager] Error guardando estado:', error);
        }
    }

    /**
     * Obtiene el estado del sidebar
     */
    static getSidebarState(): SidebarState | null {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const state = JSON.parse(data) as SidebarState;
                console.log('[SidebarStateStorageManager] Estado recuperado:', state);
                return state;
            }
            console.log('[SidebarStateStorageManager] No hay estado guardado');
            return null;
        } catch (error) {
            console.error('[SidebarStateStorageManager] Error recuperando estado:', error);
            return null;
        }
    }

    /**
     * Limpia el estado del sidebar
     */
    static clearSidebarState(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('[SidebarStateStorageManager] Estado limpiado');
        } catch (error) {
            console.error('[SidebarStateStorageManager] Error limpiando estado:', error);
        }
    }
}