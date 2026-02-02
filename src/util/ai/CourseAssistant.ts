import { ChatStorageManager } from "../storage/ChatStorageManager";
import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import type { Message } from "./OpenAIService";
import { TOOLS } from "./Tools";

export { CourseAssistant };

/**
 * Asistente para funcionalidad general del curso
 * Maneja conversaciones y herramientas relacionadas con el curso
 */
class CourseAssistant extends BaseAssistant {

    private static readonly TOOLS = [
        'getSectionContent',
        'getPageContent',
        'getResourceContent',
        'explainExercise',
        'solveExercise'
    ];

    constructor(config: AssistantConfig) {
        super(config, CourseAssistant.TOOLS);
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
     * Gets a user-friendly display name for a tool call based on its arguments.
     * Looks up section/resource/page names in the course structure.
     */
    private getDisplayNameForToolCall(toolName: string, args: Record<string, any>): string | undefined {
        if (!this.course) return undefined;

        switch (toolName) {
            case 'getSectionContent': {
                const sectionId = args.sectionId;
                const section = this.course.sections.find(s => s.id === sectionId);
                return section?.title;
            }
            case 'getPageContent': {
                // Pages are resources of type 'page' within sections
                const pageId = args.pageId;
                for (const section of this.course.sections) {
                    const page = section.resources.find(r => r.id === pageId);
                    if (page) return page.name;
                }
                return undefined;
            }
            case 'getResourceContent': {
                const resourceId = args.resourceId;
                for (const section of this.course.sections) {
                    const resource = section.resources.find(r => r.id === resourceId);
                    if (resource) return resource.name;
                }
                return undefined;
            }
            default:
                return undefined;
        }
    }

    /**
     * Builds the full system prompt with course information
     */
    private buildSystemPrompt(exercises?: any[]): string {
        const courseContext = JSON.stringify(this.course);

        let exerciseContext = '';
        if (exercises && exercises.length > 0) {
            // Create exercise list in JSON format for clarity
            const exerciseList = exercises.map((ex, index) => ({
                index: index + 1,
                name: ex.name,
                isChallenge: ex.allowed === false,
                isTiquismiqui: ex.isTiquismiqui === true
            }));

            const challengeCount = exercises.filter(ex => ex.allowed === false).length;
            const tiquismiquiCount = exercises.filter(ex => ex.isTiquismiqui === true).length;
            const allowedCount = exercises.length - challengeCount;

            exerciseContext = `\n\nEXERCISES AVAILABLE ON THIS PAGE:
The user is currently on a page with ${exercises.length} exercises (${allowedCount} allowed, ${challengeCount} challenge, ${tiquismiquiCount} tiquismiquis).

List of exercises in JSON format:
${JSON.stringify(exerciseList, null, 2)}

IMPORTANT - HOW TO USE THE INDEX:
- When the user asks to see/explain/solve an exercise (e.g., "explain exercise 3", "the second exercise", etc.), use the "index" field of the corresponding JSON.
- For example, if the user asks "explain exercise 2", look for the object with "index": 2 in the JSON and use that value (2) in the tool.

IMPORTANT ABOUT CHALLENGE EXERCISES:
- Exercises with "isChallenge": true CANNOT be explained.
- If the user requests an explanation for a challenge exercise, inform them that it is blocked by the teacher so they can solve it on their own as a challenge.
- DO NOT use the explainExercise tool for challenge exercises.
- Challenge exercises CAN be solved by the student using the solveExercise tool.

IMPORTANT ABOUT TIQUISMIQUIS EXERCISES:
- Exercises with "isTiquismiqui": true can be explained, but BEFORE you must explicitly warn that the teacher marked them as tiquismiquis and that the explanation might not be entirely correct.
- Ask the student if they want to continue. Only call explainExercise for a tiquismiquis exercise when the student confirms they understand the risk and want the explanation anyway.
- When explaining or providing information related to a tiquismiquis exercise, remind them in your response to analyze it critically.

INTERPRET USER INTENT:
There are two possible actions with exercises:
1. EXPLAIN (you explain the exercise): Use explainExercise
2. SOLVE (the student provides their solution): Use solveExercise
In both cases, your response MUST NOT be an explanation/request for the solution. The tools manage that part. Your response should just clarify the action taken (without mentioning the name of the tool itself).

Interpret intent according to these guidelines:

ASK FOR EXPLANATION (use explainExercise):
- "explain exercise 3"
- "solve exercise 3"
- "do exercise 3"
- "resolve exercise 3"
- "help me with exercise 3"
- "show me how to do exercise 3"
→ The student wants YOU to explain/show the solution

SUBMIT SOLUTION (use solveExercise):
- "I want to solve exercise 3"
- "I want to give you my solution for exercise 3"
- "I am going to solve exercise 3"
- "I am ready to do exercise 3"
- "I want to try exercise 3"
- "send my answer for exercise 3"
→ The student wants to open the form to SUBMIT their own solution

AMBIGUOUS CASES:
If the request is ambiguous (e.g., "I want to do exercise 3"), ask the user:
"Do you want me to explain how to solve exercise 3, or do you prefer to try it on your own and submit your solution?"

AVAILABLE ACTIONS:
- To explain an ALLOWED exercise (isChallenge: false): use the explainExercise tool with the exercise "index".
- For the student to submit their solution (any exercise): use the solveExercise tool with the exercise "index".`;
        }        // Generic prompt template
        const template = `You are an assistant in a Chrome extension whose goal is {role}.

{toolsDescription}

IMPORTANT INSTRUCTIONS:
- Cuando el usuario mencione una sección por su título/nombre, busca su ID en la lista de sections anterior. El usuario no conoce los IDs, solo los títulos, así que NUNCA debes preguntarle el ID, sino buscarlo en la lista de secciones que se te proporciona al inicio. Si no sabes donde buscar, mira en todas las secciones hasta encontrar lo que buscas. Debes preguntarte "¿dónde es más probable que esté esta información?" y buscar en consecuencia. Nunca decirle al usuario que no sabes el ID o que no tienes acceso a esa información.
- Para obtener el contenido detallado de una sección, usa la herramienta getSectionContent con el ID de la sección
- Los IDs de las secciones son los valores del campo "id" (por ejemplo: "1378079")
- Si el usuario pide información sobre "la sección 2" o "tema 2", busca la sección con sectionNumber: 2 y usa su ID
- Responde de forma directa, útil y concisa
- Si necesitas información sobre una sección específica, llama a getSectionContent para obtenerla antes de responder
- Recuerda que NUNCA debes pedirle al usuario que te proporcione IDs, sino buscarlos tú mismo en la estructura del curso. El usuario no tiene esos IDs ni va a saber dártelos. La información que tienes es suficiente para encontrar los IDs necesarios.

{exerciseContext}

RESPONSE FORMAT:
In the following cases, respond as follows:
- If you call explainExercise, just respond with: "I have opened the explanation for exercise {exercise name} for you." in the same language as the user.
- If you call solveExercise, just respond with: "I have opened the solution form for exercise {exercise name}." in the same language as the user.
- If you do not need to use any tool, respond normally.

COURSE INFORMATION:
Below is the complete course structure with all available sections. Each section has a unique ID that you must use when you need to get its detailed content.

{courseContext}`;

        // Variables to substitute in the template
        const variables = {
            role: 'Asistente basado en chat para ayudar a los estudiantes con el contenido y ejercicios de su curso en línea',
            toolsDescription: 'Tienes acceso a las herramientas getSectionContent, getPageContent, getResourceContent, explainExercise y solveExercise para consultar material del curso y trabajar con ejercicios.',
            exerciseContext: exerciseContext,
            courseContext: courseContext
        };

        return this.buildPromptFromTemplate(template, variables);
    }

    /**
     * Generates an assistant response using the current course
     * @param userMessage User message
     * @param resetHistory If true, resets conversation history
     * @param exercises Optional list of exercises available on the current page
     * @returns The final assistant response
     */
    async generateResponse(userMessage: string, resetHistory: boolean = false, exercises?: any[]): Promise<string> {
        if (resetHistory) {
            await this.resetChatHistory();
        }

        // Always build the system prompt with current exercises
        // This ensures context is updated even if the page changes
        const systemPrompt = this.buildSystemPrompt(exercises);

        // Callback to notify frontend about tool calls
        const notifyToolCalls = async (calls: any[]) => {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs.length > 0 && tabs[0].id) {
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toolCallsUpdate',
                        toolCalls: calls.map(c => {
                            const toolName = c.function.name;
                            const args = JSON.parse(c.function.arguments || '{}');
                            return {
                                name: toolName,
                                arguments: c.function.arguments,
                                displayName: this.getDisplayNameForToolCall(toolName, args)
                            };
                        })
                    });
                }
            } catch (error) {
                console.error('[CourseAssistant] Error notifying tool calls:', error);
            }
        };

        const response = await this.openAIService.processResponseWithTools(
            (name: string, args: any) => this.executeToolCall(name, args),
            userMessage,
            systemPrompt,
            this.allowedTools.map(tool => TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean),
            notifyToolCalls
        );

        // Save history after each interaction
        await this.saveChatHistory();

        return response;
    }
}
