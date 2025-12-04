import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import { ResponseOptions } from "./OpenAIService";
import { ExplanationSchema, ExplanationSchemaType } from "./schemas";
import { TOOLS } from "./Tools";

export { ExplanationAssistant };

/**
 * Asistente especializado en generar explicaciones tutoriales para ejercicios
 */
class ExplanationAssistant extends BaseAssistant {

    private static readonly TOOLS = [];

    constructor(config: AssistantConfig) {
        super(config, ExplanationAssistant.TOOLS);
    }

    /**
     * Construye el contexto pedagógico común para prompts
     */
    private buildPedagogicalContext(
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string
    ): { conceptsContext: string; objectivesContext: string; alignmentNote: string; progressContext: string } {
        const progressContext = progressSummary
            ? `PROGRESO DEL ALUMNO:\n${progressSummary}\nCONSIDERACIONES:\n- Reduce la verbosidad para conceptos que el alumno ya ha trabajado en laboratorios/ejercicios completados.\n- Puedes asumir familiaridad con los conceptos básicos de los laboratorios completados.\n- Enfócate en los aspectos nuevos o más avanzados del ejercicio actual.`
            : '';

        const conceptsContext = concepts && concepts.length > 0
            ? `- Este ejercicio trabaja los siguientes conceptos: ${concepts.join(', ')}`
            : '';

        const objectivesContext = learningObjectives
            ? `- Objetivos de aprendizaje de la página: ${learningObjectives}`
            : '';

        const alignmentNote = concepts || learningObjectives
            ? '- Asegúrate de que tu explicación se alinee con estos objetivos de aprendizaje y enfoque especialmente en los conceptos mencionados.'
            : '';

        return { conceptsContext, objectivesContext, alignmentNote, progressContext };
    }

    /**
     * Genera una explicación estructurada paso a paso para un ejercicio
     * @param exerciseName - Nombre del ejercicio
     * @param exerciseStatement - Enunciado completo del ejercicio
     * @param exerciseContext - Contexto adicional del ejercicio (ej. esquema de BD, especificaciones)
     * @param concepts - Conceptos que se trabajan en la página (opcional)
     * @param learningObjectives - Objetivos de aprendizaje de la página (opcional)
     * @param progressSummary - Resumen del progreso del alumno (opcional)
     * @param responseOptions - Opciones de verbosidad y razonamiento (opcional)
     * @returns Explicación estructurada con pasos
     */
    async generateExplanation(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        responseOptions?: ResponseOptions
    ): Promise<ExplanationSchemaType> {
        console.log(`[generateExplanation] Generando explicación para: ${exerciseName}`);
        if (responseOptions) {
            console.log(`[generateExplanation] Opciones: verbosity=${responseOptions.verbosity}, reasoning=${responseOptions.reasoningEffort}`);
        }

        const assistantConfig = this.config.explanationAssistant;
        const pedagogicalContext = this.buildPedagogicalContext(concepts, learningObjectives, progressSummary);

        // Plantilla genérica del system prompt
        const systemPromptTemplate = `Eres un {role}.
Tu tarea es {taskDescription}

METODOLOGÍA:

{methodology}

FORMATO DE SALIDA:
{outputFormat}
{contextNote}
{additionalRules}

CONTEXTO PEDAGÓGICO:
{conceptsContext}
{objectivesContext}
{alignmentNote}

{progressContext}

{importantNotes}`;

        const systemPromptVariables = {
            role: assistantConfig.role,
            taskDescription: assistantConfig.taskDescription,
            methodology: assistantConfig.methodology,
            outputFormat: assistantConfig.outputFormat,
            contextNote: exerciseContext ? '- Incluye ejemplos concretos usando el contexto del ejercicio proporcionado.' : '',
            additionalRules: assistantConfig.additionalRules || '',
            ...pedagogicalContext,
            importantNotes: assistantConfig.importantNotes || ''
        };

        const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

        const userPrompt = `Por favor, genera una explicación paso a paso para el siguiente ejercicio:

**${exerciseName}**

${exerciseStatement}

${exerciseContext ? `Contexto del ejercicio:\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

Antes de generar la explicación, considera consultar el material de teoría del curso para asegurarte de que tu explicación se alinea con lo que se ha enseñado en clase.

NOTA: Después de generar la explicación, el alumno tendrá la oportunidad de hacer preguntas de seguimiento sobre la explicación proporcionada.`;

        try {
            // Reiniciar historial para esta llamada específica
            this.openAIService.resetConversation();

            // Usar la nueva función que permite tools con respuestas estructuradas
            const response = await this.openAIService.generateStructuredResponse<ExplanationSchemaType>(
                ExplanationSchema,
                "explanation",
                userPrompt,
                systemPrompt,
                undefined,
                responseOptions
            );

            console.log(`[generateExplanation] Explicación generada con ${response.steps.length} pasos`);
            return response;

        } catch (error) {
            console.error(`[generateExplanation] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al generar explicación: ${error.message}`);
            }
            throw new Error('Error desconocido al generar explicación');
        }
    }

    /**
     * Continúa la conversación después de generar una explicación
     * Permite al alumno hacer preguntas de seguimiento
     * @param userMessage Pregunta del alumno
     * @returns Respuesta del asistente
     */
    async continueConversation(userMessage: string): Promise<string> {
        console.log(`[continueConversation] Procesando pregunta de seguimiento`);

        try {
            // Usar processResponseWithTools sin resetear el historial
            const response = await this.openAIService.processResponseWithTools(
                this.executeToolCall.bind(this),
                userMessage,
                undefined,
                this.allowedTools.map(tool => TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean)
            );

            console.log(`[continueConversation] Respuesta generada`);
            return response;

        } catch (error) {
            console.error(`[continueConversation] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al responder pregunta: ${error.message}`);
            }
            throw new Error('Error desconocido al responder pregunta');
        }
    }

    /**
     * Inicializa el contexto para preguntas de seguimiento cuando se carga una explicación guardada
     * @param exerciseName - Nombre del ejercicio
     * @param exerciseStatement - Enunciado completo del ejercicio
     * @param explanation - Explicación generada previamente
     * @param exerciseContext - Contexto adicional del ejercicio
     * @param concepts - Conceptos que se trabajan en la página
     * @param learningObjectives - Objetivos de aprendizaje de la página
     * @param progressSummary - Resumen del progreso del alumno
     * @param chatHistory - Historial previo de mensajes del chat (opcional)
     */
    async initializeContextForFollowUp(
        exerciseName: string,
        exerciseStatement: string,
        explanation: ExplanationSchemaType,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        chatHistory?: Array<{ role: string; content: string }>
    ): Promise<void> {
        console.log(`[initializeContextForFollowUp] Inicializando contexto para: ${exerciseName}`);

        const assistantConfig = this.config.explanationAssistant;
        const pedagogicalContext = this.buildPedagogicalContext(concepts, learningObjectives, progressSummary);

        const systemPromptTemplate = `Eres un {role}.
Has generado una explicación paso a paso para el siguiente ejercicio, y ahora el alumno está haciendo preguntas de seguimiento sobre la explicación.

EJERCICIO: {exerciseName}

ENUNCIADO:
{exerciseStatement}

{contextNote}

METODOLOGÍA:

{methodology}

{additionalRules}

CONTEXTO PEDAGÓGICO:
{conceptsContext}
{objectivesContext}
{alignmentNote}

{progressContext}

{importantNotes}

NOTA: El alumno puede hacer preguntas sobre cualquier aspecto de la explicación. Sé claro, conciso y pedagógico en tus respuestas.`;

        const systemPromptVariables = {
            role: assistantConfig.role,
            exerciseName: exerciseName,
            exerciseStatement: exerciseStatement,
            methodology: assistantConfig.methodology,
            contextNote: exerciseContext ? `CONTEXTO DEL EJERCICIO:\n\`\`\`\n${exerciseContext}\n\`\`\`` : '',
            additionalRules: assistantConfig.additionalRules || '',
            ...pedagogicalContext,
            importantNotes: assistantConfig.importantNotes || ''
        };

        const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

        // Crear un resumen de la explicación para el contexto
        const explanationSummary = explanation.steps.map((step, i) =>
            `Paso ${i + 1} - ${step.title}: ${step.content.substring(0, 200)}...`
        ).join('\n\n');

        const assistantMessage = `Ya has generado la siguiente explicación para el ejercicio:

${explanationSummary}

El alumno ahora hará preguntas de seguimiento sobre esta explicación.`;

        // Resetear e inicializar el contexto
        this.openAIService.resetConversation();

        // Agregar el system prompt y el contexto de la explicación al historial
        const history: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'assistant', content: assistantMessage }
        ];

        // Si hay historial de chat previo, restaurarlo
        if (chatHistory && chatHistory.length > 0) {
            console.log(`[initializeContextForFollowUp] Restaurando ${chatHistory.length} mensajes del historial`);
            history.push(...chatHistory);
        }

        this.openAIService.setConversationHistory(history);

        console.log(`[initializeContextForFollowUp] Contexto inicializado`);
    }
}
