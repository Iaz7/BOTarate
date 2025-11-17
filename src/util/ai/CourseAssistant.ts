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
            // Crear lista de ejercicios en formato JSON para mayor claridad
            const exerciseList = exercises.map((ex, index) => ({
                index: index + 1,
                name: ex.name,
                isChallenge: ex.allowed === false,
                isTiquismiqui: ex.isTiquismiqui === true
            }));

            const challengeCount = exercises.filter(ex => ex.allowed === false).length;
            const tiquismiquiCount = exercises.filter(ex => ex.isTiquismiqui === true).length;
            const allowedCount = exercises.length - challengeCount;

            exerciseContext = `\n\nEJERCICIOS DISPONIBLES EN ESTA PÁGINA:
El usuario está actualmente en una página con ${exercises.length} ejercicios (${allowedCount} permitidos, ${challengeCount} de reto, ${tiquismiquiCount} tiquismiquis).

Lista de ejercicios en formato JSON:
${JSON.stringify(exerciseList, null, 2)}

IMPORTANTE - CÓMO USAR EL ÍNDICE:
- Cuando el usuario pida ver/explicar/resolver un ejercicio (por ejemplo: "explica el ejercicio 3", "el segundo ejercicio", etc.), usa el campo "index" del JSON correspondiente.
- Por ejemplo, si el usuario pide "explica el ejercicio 2", busca el objeto con "index": 2 en el JSON y usa ese valor (2) en la herramienta.

IMPORTANTE SOBRE EJERCICIOS DE RETO:
- Los ejercicios con "isChallenge": true NO pueden ser explicados.
- Si el usuario solicita la explicación de un ejercicio de reto, infórmale que está bloqueado por el profesor para que lo resuelva por su cuenta como desafío.
- NO uses la herramienta explainExercise para ejercicios de reto.
- Los ejercicios de reto SÍ pueden ser resueltos por el estudiante usando la herramienta solveExercise.

IMPORTANTE SOBRE EJERCICIOS TIQUISMIQUIS:
- Los ejercicios con "isTiquismiqui": true sí pueden ser explicados, pero ANTES debes advertir explícitamente que el profesor los marcó como tiquismiquis y que la explicación podría no ser correcta del todo.
- Pregunta al alumno si quiere continuar. Solo llama a explainExercise para un ejercicio tiquismiquis cuando el alumno confirme que entiende el riesgo y desea la explicación igualmente.
- Cuando expliques o entregues información relacionada con un ejercicio tiquismiquis, recuerda en tu respuesta que debe analizarla de forma crítica.

INTERPRETAR LA INTENCIÓN DEL USUARIO:
Hay dos acciones posibles con los ejercicios:
1. EXPLICAR (tú explicas el ejercicio): Usa explainExercise
2. SOLUCIONAR (el alumno proporciona su solución): Usa solveExercise

Interpreta la intención según estas pautas:

PEDIR EXPLICACIÓN (usa explainExercise):
- "explica el ejercicio 3"
- "soluciona el ejercicio 3"
- "haz el ejercicio 3"
- "resuelve el ejercicio 3"
- "ayúdame con el ejercicio 3"
- "muéstrame cómo hacer el ejercicio 3"
→ El alumno quiere que TÚ le expliques/muestres la solución

ENTREGAR SOLUCIÓN (usa solveExercise):
- "quiero solucionar el ejercicio 3"
- "quiero darte mi solución del ejercicio 3"
- "voy a resolver el ejercicio 3"
- "estoy listo para hacer el ejercicio 3"
- "quiero intentar el ejercicio 3"
- "enviar mi respuesta del ejercicio 3"
→ El alumno quiere abrir el formulario para ENVIAR su propia solución

CASOS AMBIGUOS:
Si la petición es ambigua (por ejemplo: "quiero hacer el ejercicio 3"), pregunta al usuario:
"¿Quieres que te explique cómo resolver el ejercicio 3, o prefieres intentarlo por tu cuenta y enviar tu solución?"

ACCIONES DISPONIBLES:
- Para explicar un ejercicio PERMITIDO (isChallenge: false): usa la herramienta explainExercise con el "index" del ejercicio.
- Para que el alumno envíe su solución (cualquier ejercicio): usa la herramienta solveExercise con el "index" del ejercicio.`;
        }        // Plantilla genérica del prompt
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

        // Siempre construir el system prompt con los ejercicios actuales
        // Esto asegura que el contexto esté actualizado incluso si cambia la página
        const systemPrompt = this.buildSystemPrompt(exercises);

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
