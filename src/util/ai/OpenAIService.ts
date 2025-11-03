import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export { OpenAIService };

    import { AIProvider, ConfigManager } from "../config/ConfigManager";
    import type { ToolCall } from "./Tools";
    import { TOOLS } from "./Tools";

interface Message {
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

class OpenAIService {

    static openai: OpenAI = new OpenAI({
        apiKey: ConfigManager.getSelectedProvider().key,
        baseURL: ConfigManager.getSelectedProvider().baseUrl,
        dangerouslyAllowBrowser: true
    });

    static conversationHistory: Message[] = [];

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

    static resetConversation(): void {
        this.conversationHistory = [];
    }

    static async generateResponseWithTools(
        userMessage?: string,
        systemPrompt?: string
    ): Promise<{ type: 'message'; content: string } | { type: 'tool_calls'; calls: ToolCall[] }> {
        this.loadProviderConfig();

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

        const response = await this.openai.chat.completions.create({
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

    static addToolResult(toolCallId: string, toolName: string, result: string): void {
        this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: result
        });
    }

    static addFileMessage(filename: string, dataUrl: string, mimeType: string): void {
        const isPdf = mimeType === 'application/pdf';
        
        this.conversationHistory.push({
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `Archivo adjunto: ${filename} (${mimeType}). ${isPdf ? 'Por favor analiza el contenido de este PDF.' : ''}`
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
    }

    /**
     * Ejecuta una herramienta específica y retorna el resultado
     * @param toolCall La llamada a la herramienta del LLM
     * @param toolExecutor Función que ejecuta la herramienta según su nombre
     * @returns El resultado de la ejecución (string o file data)
     */
    static async executeToolCall(
        toolCall: ToolCall,
        toolExecutor: (name: string, args: any) => Promise<string | { type: 'file'; data: any }>
    ): Promise<void> {
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

    /**
     * Procesa una respuesta del LLM que puede contener tool calls,
     * ejecutándolos recursivamente hasta obtener una respuesta final
     * @param userMessage Mensaje del usuario (opcional para llamadas recursivas)
     * @param systemPrompt Prompt del sistema (opcional)
     * @param toolExecutor Función que ejecuta las herramientas
     * @returns La respuesta final del LLM
     */
    static async processResponseWithTools(
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

    /**
     * Genera una respuesta estructurada usando Zod para validación
     * @param schema Esquema Zod para validar la respuesta
     * @param schemaName Nombre descriptivo del esquema
     * @param userMessage Mensaje del usuario
     * @param systemPrompt Prompt del sistema
     * @returns El objeto parseado y validado según el esquema
     */
    static async generateStructuredResponse<T extends z.ZodTypeAny>(
        schema: T,
        schemaName: string,
        userMessage: string,
        systemPrompt: string
    ): Promise<z.infer<T>> {
        this.loadProviderConfig();

        console.log(`[generateStructuredResponse] Generando respuesta estructurada: ${schemaName}`);

        // Convertir el esquema Zod a JSON Schema para incluirlo en el prompt
        const jsonSchema = zodToJsonSchema(schema, schemaName);
        const schemaDescription = JSON.stringify(jsonSchema, null, 2);

        // Modificar el system prompt para incluir el esquema
        const enhancedSystemPrompt = `${systemPrompt}

FORMATO DE RESPUESTA REQUERIDO:
Debes responder ÚNICAMENTE con un objeto JSON válido que cumpla con el siguiente esquema:

${schemaDescription}

IMPORTANTE:
- Responde SOLO con el JSON, sin texto adicional antes o después
- No uses bloques de código markdown (\`\`\`json)
- Asegúrate de que el JSON sea válido y cumpla con el esquema`;

        const response = await this.openai.chat.completions.create({
            model: ConfigManager.getSelectedModel(),
            messages: [
                {
                    role: 'system',
                    content: enhancedSystemPrompt
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            response_format: {
                type: "json_object"
            },
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No se recibió respuesta del modelo');
        }

        console.log(`[generateStructuredResponse] Respuesta recibida, parseando...`);
        
        // Parsear y validar con Zod
        const parsed = schema.parse(JSON.parse(content));

        console.log(`[generateStructuredResponse] Respuesta parseada exitosamente`);
        return parsed;
    }
}
