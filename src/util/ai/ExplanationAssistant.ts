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

    private static readonly TOOLS = [
        'getPageContent',
        'getFilteredFileContent'
    ];

    constructor(config: AssistantConfig) {
        super(config, ExplanationAssistant.TOOLS);
    }

    /**
     * Builds common pedagogical context for prompts
     */
    private buildPedagogicalContext(
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string
    ): { conceptsContext: string; objectivesContext: string; alignmentNote: string; progressContext: string } {
        const progressContext = progressSummary
            ? `STUDENT PROGRESS:\n${progressSummary}\nCONSIDERATIONS:\n- Reduce verbosity for concepts the student has already worked on in completed labs/exercises.\n- You can assume familiarity with basic concepts from completed labs.\n- Focus on new or more advanced aspects of the current exercise.`
            : '';

        const conceptsContext = concepts && concepts.length > 0
            ? `- This exercise works on the following concepts: ${concepts.join(', ')}`
            : '';

        const objectivesContext = learningObjectives
            ? `- Learning objectives of the page: ${learningObjectives}`
            : '';

        const alignmentNote = concepts || learningObjectives
            ? '- Ensure your explanation aligns with these learning objectives and focuses especially on the mentioned concepts. If a concept is not listed, avoid including it in your explanation. Try another approach with the concepts and objectives provided.'
            : '';

        return { conceptsContext, objectivesContext, alignmentNote, progressContext };
    }

    /**
     * Guide for using tools that access lab content only when the student requests it
     */
    private buildLabContentToolsNote(): string {
        return `- Use these tools only if the student asks for examples or concrete data present in the lab content (e.g., INSERT rows).
- Try to filter as much as possible to return only what is strictly relevant.
- getPageContent(pageId): retrieves lab page content to locate file markers [FILEx:TEXT:name.sql].
- getFilteredFileContent(pageId, fileId, regexPattern): extracts only necessary sections from text files. For example, to get only INSERTs for tables "students" and "enrollments" use a pattern like "INSERT\\s+INTO\\s+(students|enrollments)[\\s\\S]+?;".
- You must always call getPageContent first to identify available files and their IDs before using getFilteredFileContent.`;
    }

    /**
     * Builds the system prompt for explanations (shared between generateExplanation and initializeContextForFollowUp)
     */
    private buildExplanationSystemPrompt(
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        pageId?: string
    ): string {
        const assistantConfig = this.config.explanationAssistant;
        const pedagogicalContext = this.buildPedagogicalContext(concepts, learningObjectives, progressSummary);

        const systemPromptTemplate = `You are a {role}.
Your task is {taskDescription}

METHODOLOGY:

{methodology}

OUTPUT FORMAT:
{outputFormat}
{contextNote}
{additionalRules}

LAB CONTENT TOOLS (use only if the student requests it):
{labContentToolsNote}

{pageIdNote}

PEDAGOGICAL CONTEXT:
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
            contextNote: exerciseContext ? '- Include concrete examples using the provided exercise context.' : '',
            additionalRules: assistantConfig.additionalRules || '',
            labContentToolsNote: this.buildLabContentToolsNote(),
            pageIdNote: pageId ? `Page ID: ${pageId}\n- Use this ID as the value for the 'pageId' parameter when calling getPageContent or getFilteredFileContent.` : '',
            ...pedagogicalContext,
            importantNotes: assistantConfig.importantNotes || ''
        };

        return this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);
    }

    /**
     * Builds the user prompt for requesting an explanation
     */
    private buildExplanationUserPrompt(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string
    ): string {
        return `Please generate a step-by-step explanation for the following exercise:

**${exerciseName}**

${exerciseStatement}

${exerciseContext ? `Exercise context:\n\`\`\`\n${exerciseContext}\n\`\`\`` : ''}

Before generating the explanation, consider consulting the course theory material to ensure your explanation aligns with what has been taught in class.

NOTE: After generating the explanation, the student will have the opportunity to ask follow-up questions about the provided explanation.`;
    }

    /**
     * Generates a structured step-by-step explanation for an exercise
     * @param exerciseName - Exercise name
     * @param exerciseStatement - Complete exercise statement
     * @param exerciseContext - Additional exercise context (e.g., DB schema, specifications)
     * @param concepts - Concepts worked on the page (optional)
     * @param learningObjectives - Learning objectives of the page (optional)
     * @param progressSummary - Student progress summary (optional)
     * @param responseOptions - Verbosity and reasoning options (optional)
     * @returns Structured explanation with steps
     */
    async generateExplanation(
        exerciseName: string,
        exerciseStatement: string,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        pageId?: string,
        responseOptions?: ResponseOptions
    ): Promise<ExplanationSchemaType> {
        console.log(`[generateExplanation] Generating explanation for: ${exerciseName}`);
        if (responseOptions) {
            console.log(`[generateExplanation] Options: verbosity=${responseOptions.verbosity}, reasoning=${responseOptions.reasoningEffort}`);
        }

        const systemPrompt = this.buildExplanationSystemPrompt(exerciseContext, concepts, learningObjectives, progressSummary, pageId);
        const userPrompt = this.buildExplanationUserPrompt(exerciseName, exerciseStatement, exerciseContext);

        try {
            // Reset history for this specific call
            this.openAIService.resetConversation();

            // Use the new function that allows tools with structured responses
            const response = await this.openAIService.generateStructuredResponse<ExplanationSchemaType>(
                ExplanationSchema,
                "explanation",
                userPrompt,
                systemPrompt,
                undefined,
                responseOptions
            );

            console.log(`[generateExplanation] Explanation generated with ${response.steps.length} steps`);
            return response;

        } catch (error) {
            console.error(`[generateExplanation] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error generating explanation: ${error.message}`);
            }
            throw new Error('Unknown error generating explanation');
        }
    }

    /**
     * Continues the conversation after generating an explanation
     * Allows the student to ask follow-up questions
     * @param userMessage Student question
     * @returns Assistant response
     */
    async continueConversation(userMessage: string): Promise<string> {
        console.log(`[continueConversation] Processing follow-up question`);

        try {
            // Use processResponseWithTools without resetting history
            const response = await this.openAIService.processResponseWithTools(
                this.executeToolCall.bind(this),
                userMessage,
                undefined,
                this.allowedTools.map(tool => TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean)
            );

            console.log(`[continueConversation] Response generated`);
            return response;

        } catch (error) {
            console.error(`[continueConversation] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error answering question: ${error.message}`);
            }
            throw new Error('Unknown error answering question');
        }
    }

    /**
     * Initializes context for follow-up questions when a saved explanation is loaded.
     * Uses the same system prompt and history format as generateExplanation to ensure consistency.
     * @param exerciseName - Exercise name
     * @param exerciseStatement - Complete exercise statement
     * @param explanation - Previously generated explanation
     * @param exerciseContext - Additional exercise context
     * @param concepts - Concepts worked on the page
     * @param learningObjectives - Learning objectives of the page
     * @param progressSummary - Student progress summary
     * @param chatHistory - Previous chat message history (optional)
     * @param pageId - Page ID for tool calls
     */
    async initializeContextForFollowUp(
        exerciseName: string,
        exerciseStatement: string,
        explanation: ExplanationSchemaType,
        exerciseContext?: string,
        concepts?: string[],
        learningObjectives?: string,
        progressSummary?: string,
        chatHistory?: Array<{ role: string; content: string }>,
        pageId?: string
    ): Promise<void> {
        console.log(`[initializeContextForFollowUp] Initializing context for: ${exerciseName}`);

        // Use the same system prompt as generateExplanation
        const systemPrompt = this.buildExplanationSystemPrompt(exerciseContext, concepts, learningObjectives, progressSummary, pageId);

        // Reconstruct the original user prompt
        const userPrompt = this.buildExplanationUserPrompt(exerciseName, exerciseStatement, exerciseContext);

        // Serialize the explanation as the assistant's original response
        const assistantResponse = JSON.stringify(explanation, null, 2);

        // Reset and initialize context
        this.openAIService.resetConversation();

        // Build history exactly as it was after generateExplanation:
        // system -> user (request) -> assistant (explanation JSON)
        const history: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: assistantResponse }
        ];

        // Restore any follow-up chat history
        if (chatHistory && chatHistory.length > 0) {
            console.log(`[initializeContextForFollowUp] Restoring ${chatHistory.length} messages from history`);
            history.push(...chatHistory);
        }

        this.openAIService.setConversationHistory(history);

        console.log(`[initializeContextForFollowUp] Context initialized with ${history.length} messages`);
    }
}
