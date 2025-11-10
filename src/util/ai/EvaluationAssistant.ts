import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import { EvaluationSchema, EvaluationSchemaType } from "./schemas";

export { EvaluationAssistant };

/**
 * Asistente especializado en evaluar soluciones de ejercicios
 */
class EvaluationAssistant extends BaseAssistant {

    constructor(config: AssistantConfig) {
        super(config);
    }

    /**
     * Evalúa una solución propuesta por el estudiante para un ejercicio
     * @param exerciseName - Nombre del ejercicio
     * @param exerciseStatement - Enunciado completo del ejercicio
     * @param studentSolution - Solución propuesta por el estudiante
     * @param exerciseContext - Contexto adicional del ejercicio (ej. esquema de BD, especificaciones)
     * @param concepts - Conceptos que se trabajan en la página (opcional)
     * @param learningObjectives - Objetivos de aprendizaje de la página (opcional)
     * @returns Evaluación estructurada con puntuación y feedback
     */
    async evaluateSolution(
        exerciseName: string,
        exerciseStatement: string,
        studentSolution: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string
    ): Promise<EvaluationSchemaType> {
        console.log(`[evaluateSolution] Evaluando solución para: ${exerciseName}`);

        const assistantConfig = this.config.evaluationAssistant;

        // Construir contexto pedagógico
        const pedagogicalContext = concepts && concepts.length > 0
            ? `- Este ejercicio trabaja los siguientes conceptos: ${concepts.join(', ')}`
            : '';
        const objectivesContext = learningObjectives
            ? `- Objetivos de aprendizaje: ${learningObjectives}`
            : '';
        const considerObjectives = concepts || learningObjectives
            ? '- Considera estos objetivos al evaluar si el estudiante usa las técnicas apropiadas.'
            : '';

        // Plantilla genérica del system prompt
        const systemPromptTemplate = `Eres un {role}.

Tu tarea es {taskDescription}

CRITERIOS DE EVALUACIÓN:

{evaluationCriteria}

ESCALA DE PUNTUACIÓN:
{scoringScale}

FORMATO DEL FEEDBACK:
{feedbackFormat}
{contextNote}

CONTEXTO PEDAGÓGICO:
{pedagogicalContext}
{objectivesContext}
{considerObjectives}

IMPORTANTE:
{importantNotes}`;

        const systemPromptVariables = {
            role: assistantConfig.role,
            taskDescription: assistantConfig.taskDescription,
            evaluationCriteria: assistantConfig.evaluationCriteria,
            scoringScale: assistantConfig.scoringScale,
            feedbackFormat: assistantConfig.feedbackFormat,
            contextNote: exerciseContext ? '- Puedes usar el contexto del ejercicio y los datos de ejemplo para ilustrar problemas' : '',
            pedagogicalContext: pedagogicalContext,
            objectivesContext: objectivesContext,
            considerObjectives: considerObjectives,
            importantNotes: assistantConfig.importantNotes || ''
        };

        const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

        const userPrompt = `Por favor, evalúa la siguiente solución propuesta por un estudiante:

**Ejercicio: ${exerciseName}**

${exerciseStatement}

${exerciseContext ? `**Contexto del ejercicio:**\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

**Solución del estudiante:**
\`\`\`
${studentSolution}
\`\`\`

Proporciona una evaluación completa con puntuación y feedback detallado.`;

        try {
            // Reiniciar historial para esta llamada específica
            this.openAIService.resetConversation();

            // Usar la función que permite respuestas estructuradas
            const response = await this.openAIService.generateStructuredResponse(
                EvaluationSchema,
                "evaluation",
                userPrompt,
                systemPrompt
            );

            console.log(`[evaluateSolution] Evaluación generada con puntuación: ${response.score}/10`);
            return response;

        } catch (error) {
            console.error(`[evaluateSolution] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al evaluar solución: ${error.message}`);
            }
            throw new Error('Error desconocido al evaluar solución');
        }
    }
}
