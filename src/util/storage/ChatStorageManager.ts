import type { Message } from '../ai/OpenAIService';
import { BaseStorageManager } from './BaseStorageManager';

export { ChatStorageManager };

interface ChatHistory {
    courseId: string;
    messages: Message[];
    lastUpdated: number;
}

/**
 * Gestor de almacenamiento para el historial de conversaciones del chat
 */
class ChatStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'chat_history_';

    /**
     * Guarda el historial de conversación para un curso específico
     */
    static async saveChatHistory(courseId: string, messages: Message[]): Promise<void> {
        const chatHistory: ChatHistory = {
            courseId,
            messages,
            lastUpdated: Date.now()
        };

        await this.saveData(this.STORAGE_KEY_PREFIX, courseId, chatHistory);
    }

    /**
     * Obtiene el historial de conversación para un curso específico
     */
    static async getChatHistory(courseId: string): Promise<Message[]> {
        const chatHistory = await this.getData<ChatHistory>(this.STORAGE_KEY_PREFIX, courseId);

        if (!chatHistory) {
            console.log(`[ChatStorageManager] No hay historial para curso ${courseId}`);
            return [];
        }

        console.log(`[ChatStorageManager] Historial recuperado para curso ${courseId}: ${chatHistory.messages.length} mensajes`);
        return chatHistory.messages;
    }

    /**
     * Limpia el historial de conversación para un curso específico
     */
    static async clearChatHistory(courseId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, courseId);
        console.log(`[ChatStorageManager] Historial eliminado para curso ${courseId}`);
    }

    /**
     * Limpia todo el historial de chat almacenado
     */
    static async clearAllChatHistory(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
        console.log(`[ChatStorageManager] Todo el historial de chat eliminado`);
    }
}
