import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import { EvaluationSchema, EvaluationSchemaType } from "./schemas";

export { EvaluationAssistant };

/**
 * Asistente especializado en evaluar soluciones de ejercicios
 */
class EvaluationAssistant extends BaseAssistant {

    private static readonly TOOLS = [];

    constructor(config: AssistantConfig) {
        super(config, EvaluationAssistant.TOOLS);
    }

    /**
     * Evaluates a solution proposed by the student for an exercise
     * @param exerciseName - Exercise name
     * @param exerciseStatement - Complete exercise statement
     * @param studentSolution - Solution proposed by the student
     * @param exerciseContext - Additional exercise context (e.g., DB schema, specifications)
     * @param concepts - Concepts worked on the page (optional)
     * @param learningObjectives - Learning objectives of the page (optional)
     * @returns Structured evaluation with score and feedback
     */
    async evaluateSolution(
        exerciseName: string,
        exerciseStatement: string,
        studentSolution: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string
    ): Promise<EvaluationSchemaType> {
        console.log(`[evaluateSolution] Evaluating solution for: ${exerciseName}`);

        const assistantConfig = this.config.evaluationAssistant;

        // Build pedagogical context
        const pedagogicalContext = concepts && concepts.length > 0
            ? `- This exercise works on the following concepts: ${concepts.join(', ')}`
            : '';
        const objectivesContext = learningObjectives
            ? `- Learning objectives: ${learningObjectives}`
            : '';
        const considerObjectives = concepts || learningObjectives
            ? '- Consider these objectives when evaluating if the student uses appropriate techniques.'
            : '';

        // Generic system prompt template
        const systemPromptTemplate = `You are an expert tutor that evaluates exercise solutions provided by students. Specifically: {role}.

Your task is {taskDescription}

EVALUATION CRITERIA:

{evaluationCriteria}

SCORING SCALE:
{scoringScale}

FEEDBACK FORMAT:
{feedbackFormat}
{contextNote}

PEDAGOGICAL CONTEXT:
{pedagogicalContext}
{objectivesContext}
{considerObjectives}

IMPORTANT:
{importantNotes}`;

        const systemPromptVariables = {
            role: assistantConfig.role,
            taskDescription: assistantConfig.taskDescription,
            evaluationCriteria: assistantConfig.evaluationCriteria,
            scoringScale: assistantConfig.scoringScale,
            feedbackFormat: assistantConfig.feedbackFormat,
            contextNote: exerciseContext ? '- You can use the exercise context and example data to illustrate problems' : '',
            pedagogicalContext: pedagogicalContext,
            objectivesContext: objectivesContext,
            considerObjectives: considerObjectives,
            importantNotes: assistantConfig.importantNotes || ''
        };

        const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

        const userPrompt = `Please evaluate the following solution proposed by a student:

**Exercise: ${exerciseName}**

${exerciseStatement}

${exerciseContext ? `**Exercise context:**\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

**Student solution:**
\`\`\`
${studentSolution}
\`\`\`

Provide a complete evaluation with score and detailed feedback.`;

        try {
            // Reset history for this specific call
            this.openAIService.resetConversation();

            // Use the function that allows structured responses
            const response: any = await this.openAIService.generateStructuredResponse(
                EvaluationSchema,
                "evaluation",
                userPrompt,
                systemPrompt
            );

            console.log(`[evaluateSolution] Evaluation generated with score: ${response.score}/10`);
            return response;

        } catch (error) {
            console.error(`[evaluateSolution] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error evaluating solution: ${error.message}`);
            }
            throw new Error('Unknown error evaluating solution');
        }
    }
}
