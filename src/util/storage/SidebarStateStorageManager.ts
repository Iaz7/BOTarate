export { SidebarStateStorageManager };

interface SidebarState {
    isCollapsed: boolean;
    activeTab: "chat" | "exercises" | "config" | "labs" | "progress" | "mode";
}

/**
 * Storage manager for sidebar state using localStorage
 */
class SidebarStateStorageManager {
    private static readonly STORAGE_KEY = 'sidebar_state';

    /**
     * Saves sidebar state
     */
    static saveSidebarState(state: SidebarState): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            console.log('[SidebarStateStorageManager] State saved');
        } catch (error) {
            console.error('[SidebarStateStorageManager] Error saving state:', error);
        }
    }

    /**
     * Gets sidebar state
     */
    static getSidebarState(): SidebarState | null {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                const state = JSON.parse(data) as SidebarState;
                console.log('[SidebarStateStorageManager] State retrieved:', state);
                return state;
            }
            console.log('[SidebarStateStorageManager] No saved state');
            return null;
        } catch (error) {
            console.error('[SidebarStateStorageManager] Error retrieving state:', error);
            return null;
        }
    }

    /**
     * Clears sidebar state
     */
    static clearSidebarState(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('[SidebarStateStorageManager] State cleared');
        } catch (error) {
            console.error('[SidebarStateStorageManager] Error clearing state:', error);
        }
    }
}