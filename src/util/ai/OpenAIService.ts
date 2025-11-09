import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { AIProvider, ConfigManager } from "../config/ConfigManager";
import type { ToolCall } from "./Tools";
import { TOOLS } from "./Tools";

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
        systemPrompt?: string
    ): Promise<string> {
        const result = await this.generateResponseWithTools(userMessage, systemPrompt);

        if (result.type === 'message') {
            // Respuesta final del LLM
            return result.content;
        }

        // El LLM quiere llamar a herramientas
        console.log(`LLM solicita ${result.calls.length} tool call(s)`);

        // Ejecutar todas las tool calls
        for (const call of result.calls) {
            await this.executeToolCall(call, toolExecutor);
        }

        // Llamar recursivamente para obtener la respuesta final
        return this.processResponseWithTools(toolExecutor);
    }

    private async generateResponseWithTools(
        userMessage?: string,
        systemPrompt?: string
    ): Promise<{ type: 'message'; content: string } | { type: 'tool_calls'; calls: ToolCall[] }> {
        // Agregar mensaje del sistema si se proporciona y el historial está vacío
        if (systemPrompt && this.conversationHistory.length === 0) {
            this.conversationHistory.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Agregar mensaje del usuario si se proporciona
        if (userMessage) {
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
        }

        const response = await OpenAIService.openai.chat.completions.create({
            model: ConfigManager.getSelectedModel(),
            messages: this.conversationHistory as any,
            tools: TOOLS as any,
            tool_choice: 'auto',
            max_tokens: 1000000
        });

        const choice = response.choices[0];
        const message = choice?.message;

        if (!message) {
            throw new Error('No se recibió respuesta del modelo');
        }

        // Agregar mensaje del asistente al historial
        this.conversationHistory.push({
            role: 'assistant',
            content: message.content,
            tool_calls: message.tool_calls as ToolCall[]
        });

        // Verificar si hay tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            return {
                type: 'tool_calls',
                calls: message.tool_calls as ToolCall[]
            };
        }

        // Retornar respuesta final
        return {
            type: 'message',
            content: message.content || ''
        };
    }

    async executeToolCall(toolCall: ToolCall, toolExecutor: (name: string, args: any) => Promise<string | { type: 'file'; data: any }>): Promise<void> {
        console.log(`Ejecutando tool: ${toolCall.function.name}`);

        try {
            const args = JSON.parse(toolCall.function.arguments);
            const toolResult = await toolExecutor(toolCall.function.name, args);

            console.log(`Resultado de ${toolCall.function.name}:`,
                typeof toolResult === 'string' ? toolResult : '[Archivo]');

            // Agregar resultado al historial
            if (typeof toolResult === 'object' && toolResult.type === 'file') {
                // Para archivos (PDFs/imágenes), agregar el resultado del tool y luego el archivo como mensaje de usuario
                this.addToolResult(
                    toolCall.id,
                    toolCall.function.name,
                    `Archivo adjuntado: ${toolResult.data.filename} (${toolResult.data.mimeType}, ${(toolResult.data.size / 1024).toFixed(2)} KB)`
                );

                // Agregar el archivo como un mensaje multimodal del usuario
                this.addFileMessage(
                    toolResult.data.filename,
                    toolResult.data.dataUrl,
                    toolResult.data.mimeType
                );
            } else {
                this.addToolResult(toolCall.id, toolCall.function.name, toolResult as string);
            }
        } catch (error) {
            console.error(`Error ejecutando ${toolCall.function.name}:`, error);
            this.addToolResult(
                toolCall.id,
                toolCall.function.name,
                `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
            );
        }
    }


    async generateStructuredResponse<T extends z.ZodTypeAny>(
        schema: T,
        schemaName: string,
        userMessage: string,
        systemPrompt: string,
        files?: Array<{ filename: string; mimeType?: string; dataUrl?: string; text?: string; url?: string }>
    ): Promise<z.infer<T>> {
        console.log(`[generateStructuredResponse] Generando respuesta estructurada: ${schemaName}`);

        // Si hay system prompt, añadirlo
        // Si está vacío, asumimos que ya hay uno en el historial
        if (systemPrompt.length > 0) {
            this.conversationHistory.push({ role: 'system', content: systemPrompt });
        }

        this.conversationHistory.push({ role: 'user', content: userMessage });

        // Si hay archivos adjuntos, añadirlos al historial
        if (files && Array.isArray(files) && files.length > 0) {
            for (const f of files) {
                this.addFileMessage(f.filename, f.dataUrl, f.mimeType, f.text);
            }
        }

        // Usar la API nativa de OpenAI para respuestas estructuradas
        const completion = await OpenAIService.openai.chat.completions.parse({
            model: ConfigManager.getSelectedModel(),
            messages: this.conversationHistory as any,
            // Cast to any to avoid deep/infinite type instantiation from zodResponseFormat
            response_format: zodResponseFormat(schema, schemaName) as any,
            max_tokens: 1000000
        });

        const parsed = completion.choices[0]?.message?.parsed;

        if (!parsed) {
            throw new Error('No se recibió respuesta estructurada del modelo');
        }

        console.log(`[generateStructuredResponse] Respuesta estructurada recibida exitosamente`);

        // Agregar la respuesta del asistente al historial
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
     * Añade un archivo al historial como mensaje del usuario.
     * Si se proporciona dataUrl se envía como image_url; si se proporciona textContent
     * se envía como texto (útil para ficheros SQL/Markdown/texto).
     */
    private addFileMessage(filename: string, dataUrl?: string, mimeType?: string, textContent?: string): void {
        const isPdf = mimeType === 'application/pdf';

        if (textContent) {
            // Enviar el contenido del archivo como texto editable
            this.conversationHistory.push({
                role: 'user',
                content: `Archivo adjunto: ${filename} (${mimeType || 'unknown'}).\n\nCONTENIDO:\n${textContent}`
            });
            return;
        }

        if (dataUrl) {
            this.conversationHistory.push({
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Archivo adjunto: ${filename} (${mimeType || 'unknown'}). ${isPdf ? 'Por favor analiza el contenido de este PDF.' : ''}`
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

        // Si no hay contenido, enviar al menos metadatos
        this.conversationHistory.push({
            role: 'user',
            content: `Archivo adjunto: ${filename} (${mimeType || 'unknown'}). El archivo está disponible pero no se ha incluido su contenido.`
        });
    }
}