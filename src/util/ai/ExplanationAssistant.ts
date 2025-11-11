import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import { ExplanationSchema, ExplanationSchemaType } from "./schemas";

export { ExplanationAssistant };

/**
 * Asistente especializado en generar explicaciones tutoriales para ejercicios
 */
class ExplanationAssistant extends BaseAssistant {

    constructor(config: AssistantConfig) {
        super(config);
    }

    /**
     * Genera una explicación estructurada paso a paso para un ejercicio
     * @param exerciseName - Nombre del ejercicio
     * @param exerciseStatement - Enunciado completo del ejercicio
     * @param exerciseContext - Contexto adicional del ejercicio (ej. esquema de BD, especificaciones)
     * @param concepts - Conceptos que se trabajan en la página (opcional)
     * @param learningObjectives - Objetivos de aprendizaje de la página (opcional)
     * @param progressSummary - Resumen del progreso del alumno (opcional)
     * @returns Explicación estructurada con pasos
     */
    async generateExplanation(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string
    ): Promise<ExplanationSchemaType> {
        console.log(`[generateExplanation] Generando explicación para: ${exerciseName}`);

        const assistantConfig = this.config.explanationAssistant;

        const progressContext = progressSummary
            ? `PROGRESO DEL ALUMNO:\n${progressSummary}\nCONSIDERACIONES:\n- Reduce la verbosidad para conceptos que el alumno ya ha trabajado en laboratorios/ejercicios completados.\n- Puedes asumir familiaridad con los conceptos básicos de los laboratorios completados.\n- Enfócate en los aspectos nuevos o más avanzados del ejercicio actual.`
            : '';

        // Construir contexto pedagógico
        const conceptsContext = concepts && concepts.length > 0
            ? `- Este ejercicio trabaja los siguientes conceptos: ${concepts.join(', ')}`
            : '';
        const objectivesContext = learningObjectives
            ? `- Objetivos de aprendizaje de la página: ${learningObjectives}`
            : '';
        const alignmentNote = concepts || learningObjectives
            ? '- Asegúrate de que tu explicación se alinee con estos objetivos de aprendizaje y enfoque especialmente en los conceptos mencionados.'
            : '';

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
            conceptsContext: conceptsContext,
            objectivesContext: objectivesContext,
            alignmentNote: alignmentNote,
            progressContext: progressContext,
            importantNotes: assistantConfig.importantNotes || ''
        };

        const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

        const userPrompt = `Por favor, genera una explicación paso a paso para el siguiente ejercicio:

**${exerciseName}**

${exerciseStatement}

${exerciseContext ? `Contexto del ejercicio:\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

Antes de generar la explicación, considera consultar el material de teoría del curso para asegurarte de que tu explicación se alinea con lo que se ha enseñado en clase.`;

        try {
            // Reiniciar historial para esta llamada específica
            this.openAIService.resetConversation();

            // Usar la nueva función que permite tools con respuestas estructuradas
            const response = await this.openAIService.generateStructuredResponse(
                ExplanationSchema,
                "explanation",
                userPrompt,
                systemPrompt
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
}
