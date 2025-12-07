import OpenAI from "openai";
import type { ResponseFormatJSONSchema } from "openai/resources/shared";

import { AIProvider, ConfigManager } from "../config/ConfigManager";
import { getReasoningInstruction, getVerbosityInstruction, supportsReasoning, supportsVerbosity } from "./ModelList";
import type { ToolCall } from "./Tools";
import { TOOLS } from "./Tools";

export type VerbosityLevel = "low" | "medium" | "high";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface ResponseOptions {
    verbosity?: VerbosityLevel;
    reasoningEffort?: ReasoningEffort;
}

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
            url: string;
            detail?: 'low' | 'high' | 'auto';
        };
    }>;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export { OpenAIService };

class OpenAIService {

    // Static configuration shared across all instances
    private static openai: OpenAI = new OpenAI({
        apiKey: ConfigManager.getSelectedProvider().key,
        baseURL: ConfigManager.getSelectedProvider().baseUrl,
        dangerouslyAllowBrowser: true
    });

    private conversationHistory: Message[] = [];

    static loadProviderConfig(): void {
        this.openai.apiKey = ConfigManager.getSelectedProvider().key;
        this.openai.baseURL = ConfigManager.getSelectedProvider().baseUrl;
    }

    // Gets model list from the specified provider, or from the selected provider by default 
    static async getModelList(provider: AIProvider | undefined = undefined): Promise<string[]> {
        if (provider != undefined) {
            this.openai.baseURL = provider?.baseUrl;
            this.openai.apiKey = provider?.key;
        }

        const list = await this.openai.models.list();

        let modelList: string[] = [];
        for await (const model of list) {
            modelList.push(model.id);
        }
        console.log(this.openai.baseURL);
        console.log(modelList);

        this.loadProviderConfig(); // Restore selected provider
        return modelList;
    }

    resetConversation(): void {
        this.conversationHistory = [];
    }

    getConversationHistory(): Message[] {
        return this.conversationHistory;
    }

    setConversationHistory(messages: Message[]): void {
        this.conversationHistory = messages;
    }

    async processResponseWithTools(
        toolExecutor: (name: string, args: any) => Promise<string | { type: 'file'; data: any }>,
        userMessage?: string,
        systemPrompt?: string,
        tools?: any[]
    ): Promise<string> {
        const result = await this.generateResponseWithTools(userMessage, systemPrompt, tools);

        if (result.type === 'message') {
            // Final LLM response
            return result.content;
        }

        // LLM wants to call tools
        console.log(`LLM requests ${result.calls.length} tool call(s)`);

        // Execute all tool calls
        for (const call of result.calls) {
            await this.executeToolCall(call, toolExecutor);
        }

        // Recursively call to get final response
        // Important: pass the same list of tools to avoid the next iteration
        // using the full `TOOLS` set by default.
        return this.processResponseWithTools(toolExecutor, undefined, undefined, tools);
    }

    private async generateResponseWithTools(
        userMessage?: string,
        systemPrompt?: string,
        tools?: any[]
    ): Promise<{ type: 'message'; content: string } | { type: 'tool_calls'; calls: ToolCall[] }> {
        // Update or add system prompt if provided
        if (systemPrompt) {
            // Check if system message already exists (first message with role='system')
            const systemMessageIndex = this.conversationHistory.findIndex(msg => msg.role === 'system');

            if (systemMessageIndex >= 0) {
                // Update existing system prompt
                this.conversationHistory[systemMessageIndex] = {
                    role: 'system',
                    content: systemPrompt
                };
                console.log('[OpenAIService] System prompt updated');
            } else {
                // Add system prompt to the beginning of history
                this.conversationHistory.unshift({
                    role: 'system',
                    content: systemPrompt
                });
                console.log('[OpenAIService] System prompt added');
            }
        }

        // Add user message if provided
        if (userMessage) {
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
        }

        const response = await OpenAIService.openai.chat.completions.create({
            model: ConfigManager.getSelectedModel(),
            messages: this.conversationHistory as any,
            tools: tools ?? TOOLS,
            tool_choice: 'auto',
            max_completion_tokens: 32768
        });

        const choice = response.choices[0];
        const message = choice?.message;

        if (!message) {
            throw new Error('No response received from model');
        }

        // Add assistant message to history
        this.conversationHistory.push({
            role: 'assistant',
            content: message.content,
            tool_calls: message.tool_calls as ToolCall[]
        });

        // Check if there are tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            return {
                type: 'tool_calls',
                calls: message.tool_calls as ToolCall[]
            };
        }

        // Return final response
        return {
            type: 'message',
            content: message.content || ''
        };
    }

    async executeToolCall(toolCall: ToolCall, toolExecutor: (name: string, args: any) => Promise<string | { type: 'file'; data: any }>): Promise<void> {
        console.log(`Executing tool: ${toolCall.function.name}`);

        try {
            const args = JSON.parse(toolCall.function.arguments);
            const toolResult = await toolExecutor(toolCall.function.name, args);

            console.log(`Result of ${toolCall.function.name}:`,
                typeof toolResult === 'string' ? toolResult : '[File]');

            if (typeof toolResult === 'object' && toolResult.type === 'file') {
                this.handleToolFileResult(toolCall, toolResult.data);
            } else {
                this.addToolResult(
                    toolCall.id,
                    toolCall.function.name,
                    typeof toolResult === 'string' ? toolResult : String(toolResult)
                );
            }
        } catch (error) {
            console.error(`Error executing ${toolCall.function.name}:`, error);
            this.addToolResult(
                toolCall.id,
                toolCall.function.name,
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }


    async generateStructuredResponse<T>(
        schema: Record<string, any>,
        schemaName: string,
        userMessage: string,
        systemPrompt: string,
        files?: Array<{ filename: string; mimeType?: string; dataUrl?: string; text?: string; url?: string }>,
        options?: ResponseOptions
    ): Promise<T> {
        console.log(`[generateStructuredResponse] Generating structured response: ${schemaName}`);

        const modelName = ConfigManager.getSelectedModel();
        let finalSystemPrompt = systemPrompt;

        // If options are specified, check model compatibility
        let overrideMaxTokens: number | undefined = undefined;
        if (options) {
            // Verbosity always goes in the prompt
            if (options.verbosity) {
                const verbosityInstruction = getVerbosityInstruction(options.verbosity);
                finalSystemPrompt = `${verbosityInstruction}\n\n${finalSystemPrompt}`;
                console.log(`[generateStructuredResponse] Verbosity instruction added to prompt: ${options.verbosity}`);
            }
            // Reasoning only if model does not support it natively
            const modelSupportsReasoning = supportsReasoning(modelName);
            if (options.reasoningEffort && !modelSupportsReasoning) {
                const reasoningInstruction = getReasoningInstruction(options.reasoningEffort);
                finalSystemPrompt = `${reasoningInstruction}\n\n${finalSystemPrompt}`;
                console.log(`[generateStructuredResponse] Model ${modelName} does not support reasoning, instruction added to prompt`);
            }
        }

        // If there is a system prompt, add it
        // If empty, assume there is already one in history
        if (finalSystemPrompt.length > 0) {
            this.conversationHistory.push({ role: 'system', content: finalSystemPrompt });
        }

        this.conversationHistory.push({ role: 'user', content: userMessage });

        // If there are attached files, add them to history
        if (files && Array.isArray(files) && files.length > 0) {
            for (const f of files) {
                this.addFileMessage(f.filename, f.dataUrl, f.mimeType, f.text);
            }
        }

        // Create response format using JSON Schema
        const responseFormat: ResponseFormatJSONSchema = {
            type: "json_schema",
            json_schema: {
                name: schemaName,
                schema: schema,
                strict: true
            }
        };

        // Build API parameters
        const apiParams: any = {
            model: modelName,
            messages: this.conversationHistory as any,
            response_format: responseFormat,
            max_completion_tokens: 32768
        };

        // Add native parameters if model supports them
        if (options) {
            const modelSupportsVerbosity = supportsVerbosity(modelName);
            const modelSupportsReasoning = supportsReasoning(modelName);

            if (options.verbosity && modelSupportsVerbosity) {
                // Note: The text.verbosity parameter is for the responses API, not chat.completions
                // For chat.completions, we use the instruction in the prompt (already added above if not supported)
                // If model supports verbosity, the API should handle it
                console.log(`[generateStructuredResponse] Model ${modelName} supports verbosity: ${options.verbosity}`);
            }

            if (options.reasoningEffort && modelSupportsReasoning) {
                apiParams.reasoning = { effort: options.reasoningEffort };
                console.log(`[generateStructuredResponse] Added reasoning effort: ${options.reasoningEffort}`);
            }
        }

        // Use native OpenAI API for structured responses
        const completion = await OpenAIService.openai.chat.completions.create(apiParams);

        const content = completion.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No structured response received from model');
        }

        const parsed = JSON.parse(content) as T;

        console.log(`[generateStructuredResponse] Structured response received successfully`);

        // Add assistant response to history
        this.conversationHistory.push({
            role: 'assistant',
            content: JSON.stringify(parsed),
            tool_calls: undefined
        });

        return parsed;
    }

    addToolResult(toolCallId: string, toolName: string, result: string): void {
        this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: result
        });
    }

    /**
     * Adds a file to history as a user message.
     * If dataUrl is provided it is sent as image_url; if textContent is provided
     * it is sent as text (useful for SQL/Markdown/text files).
     */
    private addFileMessage(filename: string, dataUrl?: string, mimeType?: string, textContent?: string): void {
        const usingOpenAI = this.isUsingOpenAIProvider();
        const isImage = this.isImageMimeType(mimeType);

        if (textContent) {
            this.conversationHistory.push({
                role: 'user',
                content: `Attached file: ${filename} (${mimeType || 'unknown'}).\n\nCONTENT:\n${textContent}`
            });
            return;
        }

        if (dataUrl && isImage) {
            this.conversationHistory.push({
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Attached file: ${filename} (${mimeType || 'unknown'}).`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: dataUrl,
                            detail: 'high'
                        }
                    }
                ]
            });
            return;
        }

        if (usingOpenAI) {
            this.conversationHistory.push({
                role: 'user',
                content: `Attached file: ${filename} (${mimeType || 'unknown'}). The OpenAI provider only allows attaching images in this flow, so the file was omitted.`
            });
            return;
        }

        if (dataUrl) {
            this.conversationHistory.push({
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Attached file: ${filename} (${mimeType || 'unknown'}).`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: dataUrl,
                            detail: 'high'
                        }
                    }
                ]
            });
            return;
        }

        this.conversationHistory.push({
            role: 'user',
            content: `Attached file: ${filename} (${mimeType || 'unknown'}). The file is available but its content has not been included.`
        });
    }

    private handleToolFileResult(toolCall: ToolCall, fileData: {
        filename: string;
        mimeType?: string;
        size?: number;
        dataUrl?: string;
        text?: string;
    }): void {
        const description = `Attached file: ${fileData.filename} (${fileData.mimeType || 'unknown'}${fileData.size ? `, ${(fileData.size / 1024).toFixed(2)} KB` : ''})`;

        if (this.isUsingOpenAIProvider()) {
            if (fileData.text) {
                this.addToolResult(
                    toolCall.id,
                    toolCall.function.name,
                    `${description}.\n\nCONTENT:\n${fileData.text}`
                );
                return;
            }

            if (fileData.dataUrl && this.isImageMimeType(fileData.mimeType)) {
                this.addToolMessageWithContent(toolCall.id, toolCall.function.name, [
                    {
                        type: 'text',
                        text: description
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: fileData.dataUrl,
                            detail: 'high'
                        }
                    }
                ]);
                return;
            }

            this.addToolResult(
                toolCall.id,
                toolCall.function.name,
                `${description}. The OpenAI provider only supports attaching images in this flow, so the file was omitted.`
            );
            return;
        }

        this.addToolResult(toolCall.id, toolCall.function.name, description);
        this.addFileMessage(fileData.filename, fileData.dataUrl, fileData.mimeType, fileData.text);
    }

    private addToolMessageWithContent(toolCallId: string, toolName: string, content: Exclude<Message['content'], string | null>): void {
        this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content
        });
    }

    private isUsingOpenAIProvider(): boolean {
        const provider = ConfigManager.getSelectedProvider();
        const normalizedName = provider.name.toLowerCase();
        const normalizedUrl = provider.baseUrl.toLowerCase();
        return normalizedName.includes('openai') || normalizedUrl.includes('openai.com');
    }

    private isImageMimeType(mimeType?: string): boolean {
        return typeof mimeType === 'string' && mimeType.startsWith('image/');
    }
}