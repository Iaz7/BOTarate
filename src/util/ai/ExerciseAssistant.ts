import { Exercise } from "../egela/Exercise";
import { ExerciseStorageManager } from "../storage/ExerciseStorageManager";
import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import { ExerciseListSchemaType } from "./schemas";
import { EXERCISE_ASSISTANT_TOOLS } from "./Tools";

export { ExerciseAssistant };

/**
 * Asistente para análisis de ejercicios
 * Maneja la identificación y análisis de ejercicios en páginas del curso
 */
class ExerciseAssistant extends BaseAssistant {

    private static readonly TOOLS = [
        'getFilteredFileContent',
        'postExercises'
    ];

    constructor(config: AssistantConfig) {
        super(config, ExerciseAssistant.TOOLS);
    }

    /**
     * Identifies exercises on a page using the LLM with structured responses
     * @param pageId Egela page ID
     * @param resourceId Resource ID (to locate it in the section resource list)
     * @returns Array of identified exercises (empty if no exercises), exercise context, and pedagogical concepts
     */
    async identifyExercises(pageId: string, resourceId?: string): Promise<{
        exercises: Exercise[];
        exerciseContext?: string;
        concepts?: string[];
        learningObjectives?: string;
    }> {
        console.log(`[identifyExercises] Identifying exercises on page: ${pageId}. Course ID: ${this.course?.id}`);

        try {
            // 1. Get page content in Markdown format + detected files
            const pageResult = await this.course!.getPageContent(pageId);
            const pageContent = pageResult.markdown;
            const attachedFiles = pageResult.files;
            console.log(`[identifyExercises] Page content obtained (${pageContent.length} characters), files: ${attachedFiles.length}`);

            // 2. Build system prompt using configuration
            const assistantConfig = this.config.exerciseAssistant;

            const systemPromptTemplate = `You are an expert assistant in {role}.

Your task is to analyze the content of an educational page, identify exercises, and extract relevant information.

The current page ID is ${pageId}.

AVAILABLE TOOLS:
1. getFilteredFileContent: To extract specific content from text files using regular expressions.
   - Use this tool when you see markers like [FILE1:TEXT:name.sql]
   - Example to get CREATE TABLEs: use the pattern "CREATE\\s+TABLE[\\s\\S]+?;"
   
2. postExercises: MANDATORY - You must use this tool exactly once at the end to submit the identified exercises.
   - This tool is your way of "responding" with the analysis results
   - You must always call it, even if there are no exercises (send an empty array)
   - If you receive "Exercises received correctly" as a response, it means your call was successful and you should not call it again. Simply end the conversation by saying "OK", as whatever you say after the post will be ignored.

WORKFLOW:
1. Analyze page content
2. If there are text files (markers [FILEn:TEXT:name]), use getFilteredFileContent to extract relevant information (only from text files)
3. Identify all exercises on the page
4. MANDATORY: Call postExercises with all collected information.

CRITERIA FOR IDENTIFYING EXERCISES:
{exerciseCriteria}

EXERCISE CONTEXT:
- {contextDescription}
- If you detect such information, include it in the "exercise_context" field
- If you don't detect it, send that field empty

CONCEPTS:
- Analyze the exercises and identify what {conceptsFieldDescription}
- If a concept is not mentioned explicitly, do not infer it from the exercise statements. The intent of the teacher may not align with your inference.
- Be specific when possible
- Examples: {conceptsExamples}
- If there are no exercises, this field must be empty

LEARNING OBJECTIVES:
- {learningObjectivesGuidance}

IMPORTANT: You must call postExercises exactly once at the end of the analysis.
`;

            const systemPromptVariables = {
                role: assistantConfig.role,
                exerciseCriteria: assistantConfig.exerciseCriteria,
                contextDescription: assistantConfig.contextDescription,
                conceptsFieldDescription: assistantConfig.conceptsFieldDescription,
                conceptsExamples: assistantConfig.conceptsExamples,
                learningObjectivesGuidance: assistantConfig.learningObjectivesGuidance,
            };

            const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

            const userPrompt = `Analyze the following content of an educational page and identify the exercises.

Page content:

${pageContent}`;

            // Use processResponseWithTools to allow the LLM to use getFilteredFileContent
            // and finally call postExercises with the results
            this.openAIService.resetConversation();
            console.log(`[identifyExercises] Starting analysis with tools`);

            let exerciseResult: ExerciseListSchemaType | null = null;

            // The toolExecutor captures when postExercises is called
            const result = await this.openAIService.processResponseWithTools(
                async (name: string, args: any) => {
                    if (name === 'postExercises') {
                        // Capture identified exercises
                        exerciseResult = args as ExerciseListSchemaType;
                        return 'Exercises received correctly';
                    }
                    // Execute other tools normally (getFilteredFileContent)
                    return this.executeToolCall(name, args);
                },
                userPrompt,
                systemPrompt,
                this.allowedTools.map(tool => EXERCISE_ASSISTANT_TOOLS.find((t: any) => t.function.name === tool)).filter(Boolean)
            );

            // Verify that a valid response was received
            if (!exerciseResult) {
                console.warn(`[identifyExercises] The LLM did not call postExercises. Returning empty result.`);
                return {
                    exercises: [],
                    exerciseContext: undefined,
                    concepts: [],
                    learningObjectives: undefined,
                };
            }

            const response: ExerciseListSchemaType = exerciseResult;
            console.log(`[identifyExercises] Response received:`, response);

            // 3. Convert to Exercise objects
            const exercises: Exercise[] = response.exercises.map(
                (ex: { name: string; statement: string }) => new Exercise(ex.name, ex.statement)
            );

            console.log(`[identifyExercises] Identified ${exercises.length} exercises, exercise_context present: ${!!response.exercise_context}`);
            console.log(`[identifyExercises] Concepts: ${response.concepts?.join(', ') || 'N/A'}`);
            console.log(`[identifyExercises] Learning objectives: ${response.learning_objectives || 'N/A'}`);

            // 4. Save data to storage for future use
            const existingExerciseData = await ExerciseStorageManager.getExerciseData(pageId);
            const exerciseDataToStore = exercises.map(ex => {
                const previous = existingExerciseData?.exercises.find(prev => prev.name === ex.name);
                return {
                    name: ex.name,
                    statement: ex.statement,
                    allowed: previous?.allowed ?? ex.allowed,
                    isTiquismiqui: previous?.isTiquismiqui ?? ex.isTiquismiqui,
                };
            });
            await ExerciseStorageManager.saveExerciseData(
                pageId,
                exerciseDataToStore,
                response.exercise_context || '',
                response.concepts || [],
                response.learning_objectives || ''
            );
            console.log(`[identifyExercises] Data saved to storage for page ${pageId}`);

            return {
                exercises,
                exerciseContext: response.exercise_context || undefined,
                concepts: response.concepts || [],
                learningObjectives: response.learning_objectives || undefined,
            };

        } catch (error) {
            console.error(`[identifyExercises] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error identifying exercises: ${error.message}`);
            }
            throw new Error('Unknown error identifying exercises');
        }
    }
}
