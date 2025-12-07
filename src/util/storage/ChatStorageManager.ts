import type { Message } from '../ai/OpenAIService';
import { BaseStorageManager } from './BaseStorageManager';

export { ChatStorageManager };

interface ChatHistory {
    courseId: string;
    messages: Message[];
    lastUpdated: number;
}

/**
 * Storage manager for chat conversation history
 */
class ChatStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'chat_history_';

    /**
     * Saves conversation history for a specific course
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
     * Gets conversation history for a specific course
     */
    static async getChatHistory(courseId: string): Promise<Message[]> {
        const chatHistory = await this.getData<ChatHistory>(this.STORAGE_KEY_PREFIX, courseId);

        if (!chatHistory) {
            console.log(`[ChatStorageManager] No history for course ${courseId}`);
            return [];
        }

        console.log(`[ChatStorageManager] History retrieved for course ${courseId}: ${chatHistory.messages.length} messages`);
        return chatHistory.messages;
    }

    /**
     * Clears conversation history for a specific course
     */
    static async clearChatHistory(courseId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, courseId);
        console.log(`[ChatStorageManager] History deleted for course ${courseId}`);
    }

    /**
     * Clears all stored chat history
     */
    static async clearAllChatHistory(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
        console.log(`[ChatStorageManager] All chat history deleted`);
    }
}
