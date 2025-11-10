import { ChatStorageManager } from "../storage/ChatStorageManager";
import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import type { Message } from "./OpenAIService";

export { CourseAssistant };

/**
 * Asistente para funcionalidad general del curso
 * Maneja conversaciones y herramientas relacionadas con el curso
 */
class CourseAssistant extends BaseAssistant {

    constructor(config: AssistantConfig) {
        super(config);
    }

    /**
     * Carga el historial de conversación desde el storage
     */
    async loadChatHistory(): Promise<Message[]> {
        if (!this.course) {
            console.log('[CourseAssistant] No hay curso activo, no se puede cargar el historial');
            return [];
        }

        const messages = await ChatStorageManager.getChatHistory(this.course.id);
        this.openAIService.setConversationHistory(messages);
        console.log(`[CourseAssistant] Historial cargado: ${messages.length} mensajes`);

        return messages;
    }

    /**
     * Guarda el historial de conversación actual en el storage
     */
    async saveChatHistory(): Promise<void> {
        if (!this.course) {
            console.log('[CourseAssistant] No hay curso activo, no se puede guardar el historial');
            return;
        }

        const messages = this.openAIService.getConversationHistory();
        await ChatStorageManager.saveChatHistory(this.course.id, messages);
        console.log(`[CourseAssistant] Historial guardado: ${messages.length} mensajes`);
    }

    /**
     * Reinicia el historial de conversación y lo elimina del storage
     */
    async resetChatHistory(): Promise<void> {
        this.openAIService.resetConversation();

        if (this.course) {
            await ChatStorageManager.clearChatHistory(this.course.id);
            console.log('[CourseAssistant] Historial reiniciado y eliminado del storage');
        }
    }

    /**
     * Construye el system prompt completo con información del curso
     */
    private buildSystemPrompt(exercises?: any[]): string {
        const courseContext = JSON.stringify(this.course);
        const assistantConfig = this.config.courseAssistant;

        let exerciseContext = '';
        if (exercises && exercises.length > 0) {
            // Crear lista manteniendo el orden original e indicando estado y un índice explícito
            // Mostramos tanto el número de posición (1..N) como un índice entre corchetes junto al nombre
            const exerciseList = exercises.map((ex, index) => {
                const pos = index + 1;
                const status = ex.allowed === false ? '[RETO]' : '[PERMITIDO]';
                // Formato: "1. [ÍNDICE:1] Nombre del ejercicio [PERMITIDO]"
                return `${pos}. [ÍNDICE:${pos}] ${ex.name} ${status}`;
            }).join('\n');

            const challengeCount = exercises.filter(ex => ex.allowed === false).length;
            const allowedCount = exercises.length - challengeCount;

            exerciseContext = `\n\nEJERCICIOS DISPONIBLES EN ESTA PÁGINA:
El usuario está actualmente en una página con ${exercises.length} ejercicios (${allowedCount} permitidos, ${challengeCount} de reto). Cuando el usuario solicite la explicación de un ejercicio específico (por ejemplo: "explica el ejercicio 3", "¿cómo se resuelve el segundo ejercicio?", etc.), debes verificar primero si es un ejercicio de reto.

Lista de ejercicios en orden (cada línea muestra: posición. [ÍNDICE:pos] Nombre DEL EJERCICIO [ESTADO]):
${exerciseList}

IMPORTANTE SOBRE EJERCICIOS DE RETO:
- Los ejercicios marcados como [RETO] NO pueden ser explicados.
- Si el usuario solicita la explicación de un ejercicio de reto, debes informarle que la resolución de ese ejercicio está bloqueada por el profesor para que lo resuelva por su cuenta como desafío.
- Menciona también qué otros ejercicios son de reto (si los hay).
- NO uses la herramienta explainExercise para ejercicios de reto.
- Los ejercicios de reto SÍ pueden ser resueltos por el estudiante usando la herramienta solveExercise.

IMPORTANTE SOBRE REFERENCIAS A EJERCICIOS:
- El usuario podrá referirse a los ejercicios por su número de posición (ejercicio 1, ejercicio 2, etc.), por nombre, o de forma relativa ("el siguiente", "el anterior").
- El número de posición (1..${exercises.length}) corresponde al orden listado arriba.
- Además, justo al lado del nombre incluimos la etiqueta [ÍNDICE:pos] — ESTE ES EL VALOR QUE DEBES PROPORCIONAR cuando el usuario te pida el índice de un ejercicio. Por ejemplo, si la línea es "2. [ÍNDICE:2] Ejercicio X [PERMITIDO]", y el usuario pide "dame el índice del ejercicio X", debes responder "2".
- Mantén siempre presente el orden de la lista para identificar correctamente los ejercicios.

Cuando el usuario pida ver/explicar un ejercicio PERMITIDO, usa la herramienta explainExercise para abrir el modal de explicación.
Cuando el usuario quiera resolver/intentar/enviar su solución para un ejercicio (PERMITIDO o DE RETO), usa la herramienta solveExercise para abrir el formulario de resolución.`;
        }

        // Plantilla genérica del prompt
        const template = `Eres un asistente en una extensión de Chrome cuyo objetivo es {role}.

{toolsDescription}

INSTRUCCIONES IMPORTANTES:
{instructions}
{exerciseContext}
{additionalRules}

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones disponibles. Cada sección tiene un ID único que debes usar cuando necesites obtener su contenido detallado.

{courseContext}`;

        // Variables para sustituir en la plantilla
        const variables = {
            role: assistantConfig.role,
            toolsDescription: assistantConfig.toolsDescription,
            instructions: assistantConfig.instructions,
            exerciseContext: exerciseContext,
            additionalRules: assistantConfig.additionalRules || '',
            courseContext: courseContext
        };

        return this.buildPromptFromTemplate(template, variables);
    }

    /**
     * Genera una respuesta del asistente usando el curso actual
     * @param userMessage Mensaje del usuario
     * @param resetHistory Si es true, reinicia el historial de conversación
     * @param exercises Lista opcional de ejercicios disponibles en la página actual
     * @returns La respuesta final del asistente
     */
    async generateResponse(userMessage: string, resetHistory: boolean = false, exercises?: any[]): Promise<string> {
        if (resetHistory) {
            await this.resetChatHistory();
        }

        // Si el historial está vacío (primera vez o después de reset), agregar el system prompt
        const conversationHistory = this.openAIService.getConversationHistory();
        const needsSystemPrompt = conversationHistory.length === 0;
        const systemPrompt = needsSystemPrompt ? this.buildSystemPrompt(exercises) : undefined;

        const response = await this.openAIService.processResponseWithTools(
            (name, args) => this.executeToolCall(name, args),
            userMessage,
            systemPrompt
        );

        // Guardar el historial después de cada interacción
        await this.saveChatHistory();

        return response;
    }
}
