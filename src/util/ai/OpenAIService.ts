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
        const previousLength = this.conversationHistory.length;
        this.conversationHistory = [];
        console.log(`[OpenAIService] Conversacion reiniciada (${previousLength} mensajes eliminados)`);
    }

    /**
     * Función unificada para generar respuestas con o sin tools, con o sin schema estructurado
     * @param options Opciones de configuración para la generación
     * @returns Respuesta del modelo (puede ser mensaje, tool calls o structured)
     */
    private static async generateResponse<T extends z.ZodTypeAny>(options: {
        userMessage?: string;
        systemPrompt?: string;
        schema?: T;
        schemaName?: string;
        files?: Array<{ filename: string; mimeType?: string; dataUrl?: string; text?: string; url?: string }>;
        useTools?: boolean;
    }): Promise<
        { type: 'message'; content: string } | 
        { type: 'tool_calls'; calls: ToolCall[] } |
        { type: 'structured'; data: z.infer<T> }
    > {
        this.loadProviderConfig();

        const { userMessage, systemPrompt, schema, schemaName, files, useTools = false } = options;

        // Construir system prompt (incluyendo schema si es necesario)
        let finalSystemPrompt = systemPrompt || '';
        if (schema && schemaName) {
            const jsonSchema = zodToJsonSchema(schema, schemaName);
            const schemaDescription = JSON.stringify(jsonSchema, null, 2);
            
            finalSystemPrompt += `

FORMATO DE RESPUESTA REQUERIDO:
Debes responder ÚNICAMENTE con un objeto JSON válido que cumpla con el siguiente esquema:

${schemaDescription}

IMPORTANTE:
- Responde SOLO con el JSON, sin texto adicional antes o después
- Asegúrate de que el JSON sea válido y cumpla con el esquema`;
        }

        // Agregar mensaje del sistema si se proporciona y el historial está vacío
        if (finalSystemPrompt && this.conversationHistory.length === 0) {
            this.conversationHistory.push({
                role: 'system',
                content: finalSystemPrompt
            });
        }

        // Agregar mensaje del usuario si se proporciona
        if (userMessage) {
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
        }

        // Añadir archivos adjuntos si existen
        if (files && Array.isArray(files) && files.length > 0) {
            for (const f of files) {
                this.addFileMessage(f.filename, f.dataUrl, f.mimeType, f.text);
            }
        }

        // Preparar parámetros de la llamada a la API
        const apiParams: any = {
            model: ConfigManager.getSelectedModel(),
            messages: this.conversationHistory as any,
            max_tokens: 1000000
        };

        // Añadir tools si está habilitado
        if (useTools) {
            apiParams.tools = TOOLS as any;
            apiParams.tool_choice = 'auto';
        }

        // Log de información de la request
        const requestTime = Date.now();
        console.log('[OpenAIService] Request iniciado');
        console.log(`[OpenAIService] Modelo: ${apiParams.model}`);
        console.log(`[OpenAIService] Mensajes en historial: ${this.conversationHistory.length}`);
        console.log(`[OpenAIService] Tools habilitadas: ${useTools ? 'Si (' + TOOLS.length + ' disponibles)' : 'No'}`);
        console.log(`[OpenAIService] Schema estructurado: ${schema ? schemaName : 'No'}`);
        
        const response = await this.openai.chat.completions.create(apiParams);
        
        // Log de información de la response
        const responseTime = Date.now() - requestTime;
        console.log(`[OpenAIService] Response recibida en ${responseTime}ms`);
        
        // Log de consumo de tokens
        if (response.usage) {
            console.log(`[OpenAIService] Tokens prompt: ${response.usage.prompt_tokens}`);
            console.log(`[OpenAIService] Tokens completion: ${response.usage.completion_tokens}`);
            console.log(`[OpenAIService] Tokens totales: ${response.usage.total_tokens}`);
            
            // Estimación de costo aproximado (basado en precios típicos de GPT-4)
            const estimatedCost = (response.usage.prompt_tokens * 0.00003 + response.usage.completion_tokens * 0.00006);
            console.log(`[OpenAIService] Costo estimado: $${estimatedCost.toFixed(6)}`);
        }
        
        // Log de información adicional
        if (response.choices[0]) {
            console.log(`[OpenAIService] Finish reason: ${response.choices[0].finish_reason}`);
            if (response.choices[0].message.tool_calls) {
                console.log(`[OpenAIService] Tool calls: ${response.choices[0].message.tool_calls.length}`);
            }
        }

        const choice = response.choices[0];
        const message = choice?.message;

        if (!message) {
            throw new Error('No se recibió respuesta del modelo');
        }

        // Si es una respuesta estructurada sin tools, parsear directamente
        if (schema && !message.tool_calls) {
            const content = message.content;
            if (!content) {
                throw new Error('No se recibió contenido del modelo');
            }

            console.log(`[generateResponse] Respuesta estructurada recibida, parseando...`);
            
            // Limpiar bloques de código si el modelo los añade
            let jsonText = (typeof content === 'string') ? content.trim() : JSON.stringify(content);
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replaceAll(/```json\n?/g, '').replaceAll(/```\n?$/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replaceAll(/```\n?/g, '');
            }

            // Parsear y validar con Zod
            const parsed = schema.parse(JSON.parse(jsonText));

            console.log(`[generateResponse] Respuesta parseada exitosamente`);
            
            // No agregar al historial en modo estructurado para mantener limpio el contexto
            return { type: 'structured', data: parsed };
        }

        // Agregar mensaje del asistente al historial (para conversaciones normales y con tools)
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

    /**
     * Añade un archivo al historial como mensaje del usuario.
     * Si se proporciona dataUrl se envía como image_url; si se proporciona textContent
     * se envía como texto (útil para ficheros SQL/Markdown/texto).
     */
    static addFileMessage(filename: string, dataUrl?: string, mimeType?: string, textContent?: string): void {
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
        const startTime = Date.now();
        console.log(`[OpenAIService] Ejecutando tool: ${toolCall.function.name}`);
        console.log(`[OpenAIService] Argumentos: ${toolCall.function.arguments}`);
        
        try {
            const args = JSON.parse(toolCall.function.arguments);
            const toolResult = await toolExecutor(toolCall.function.name, args);

            const executionTime = Date.now() - startTime;
            console.log(`[OpenAIService] Tool ${toolCall.function.name} ejecutada en ${executionTime}ms`);
            
            if (typeof toolResult === 'string') {
                const preview = toolResult.length > 200 ? toolResult.substring(0, 200) + '...' : toolResult;
                console.log(`[OpenAIService] Resultado: ${preview}`);
            } else {
                console.log(`[OpenAIService] Resultado: Archivo ${toolResult.data.filename}`);
            }

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
            const executionTime = Date.now() - startTime;
            console.error(`[OpenAIService] Error en tool ${toolCall.function.name} (${executionTime}ms)`);
            console.error(`[OpenAIService] Error:`, error);
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
     * @param toolExecutor Función que ejecuta las herramientas
     * @param userMessage Mensaje del usuario (opcional para llamadas recursivas)
     * @param systemPrompt Prompt del sistema (opcional)
     * @returns La respuesta final del LLM
     */
    static async processWithTools(
        toolExecutor: (name: string, args: any) => Promise<string | { type: 'file'; data: any }>,
        userMessage?: string,
        systemPrompt?: string
    ): Promise<string> {
        console.log('[OpenAIService] Iniciando processWithTools');
        
        const result = await this.generateResponse({
            userMessage,
            systemPrompt,
            useTools: true
        });

        if (result.type === 'message') {
            // Respuesta final del LLM
            console.log('[OpenAIService] Respuesta final recibida');
            return result.content;
        }

        if (result.type === 'structured') {
            throw new Error('Resultado inesperado: structured response en processWithTools');
        }

        // El LLM quiere llamar a herramientas
        console.log(`[OpenAIService] LLM solicita ${result.calls.length} tool calls`);

        // Ejecutar todas las tool calls
        for (const call of result.calls) {
            await this.executeToolCall(call, toolExecutor);
        }

        // Llamar recursivamente para obtener la respuesta final
        console.log('[OpenAIService] Continuando conversacion despues de tool calls');
        return this.processWithTools(toolExecutor);
    }

    /**
     * Genera una respuesta estructurada usando Zod para validación
     * @param schema Esquema Zod para validar la respuesta
     * @param schemaName Nombre descriptivo del esquema
     * @param userMessage Mensaje del usuario
     * @param systemPrompt Prompt del sistema
     * @param files Archivos adjuntos (opcional)
     * @returns El objeto parseado y validado según el esquema
     */
    static async generateStructured<T extends z.ZodTypeAny>(
        schema: T,
        schemaName: string,
        userMessage: string,
        systemPrompt: string,
        files?: Array<{ filename: string; mimeType?: string; dataUrl?: string; text?: string; url?: string }>
    ): Promise<z.infer<T>> {
        console.log(`[OpenAIService] Generando respuesta estructurada: ${schemaName}`);
        if (files && files.length > 0) {
            console.log(`[OpenAIService] Archivos adjuntos: ${files.length}`);
        }

        const result = await this.generateResponse({
            userMessage,
            systemPrompt,
            schema,
            schemaName,
            files,
            useTools: false
        });

        if (result.type === 'structured') {
            console.log(`[OpenAIService] Respuesta estructurada generada: ${schemaName}`);
            return result.data;
        }

        // Si llegamos aquí es porque el modelo devolvió tool calls o un mensaje no estructurado
        throw new Error('El modelo no devolvió una respuesta estructurada válida');
    }

    /**
     * Procesa una respuesta estructurada que puede usar tools
     * @param schema Esquema Zod para validar la respuesta
     * @param schemaName Nombre descriptivo del esquema
     * @param toolExecutor Función que ejecuta las herramientas
     * @param userMessage Mensaje del usuario
     * @param systemPrompt Prompt del sistema
     * @param files Archivos adjuntos (opcional)
     * @returns El objeto parseado y validado según el esquema
     */
    static async processStructuredWithTools<T extends z.ZodTypeAny>(
        schema: T,
        schemaName: string,
        toolExecutor: (name: string, args: any) => Promise<string | { type: 'file'; data: any }>,
        userMessage: string,
        systemPrompt: string,
        files?: Array<{ filename: string; mimeType?: string; dataUrl?: string; text?: string; url?: string }>
    ): Promise<z.infer<T>> {
        console.log(`[OpenAIService] Iniciando processStructuredWithTools: ${schemaName}`);
        if (files && files.length > 0) {
            console.log(`[OpenAIService] Archivos adjuntos: ${files.length}`);
        }

        const result = await this.generateResponse({
            userMessage,
            systemPrompt,
            schema,
            schemaName,
            files,
            useTools: true
        });

        // Si es una respuesta estructurada directa, retornarla
        if (result.type === 'structured') {
            console.log(`[OpenAIService] Respuesta estructurada generada: ${schemaName}`);
            return result.data;
        }

        // Si el modelo quiere usar tools, procesarlas
        if (result.type === 'tool_calls') {
            console.log(`[OpenAIService] LLM solicita ${result.calls.length} tool calls`);

            // Ejecutar todas las tool calls
            for (const call of result.calls) {
                await this.executeToolCall(call, toolExecutor);
            }

            // Llamar recursivamente para obtener la respuesta estructurada final
            console.log('[OpenAIService] Continuando para obtener respuesta estructurada');
            return this.processStructuredWithTools(
                schema,
                schemaName,
                toolExecutor,
                undefined as any, // No enviar nuevo mensaje de usuario
                undefined as any // No enviar nuevo system prompt
            );
        }

        // Si llegamos aquí, el modelo devolvió un mensaje no estructurado
        throw new Error('El modelo no devolvió una respuesta estructurada válida');
    }
}
