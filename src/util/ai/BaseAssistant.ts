import { getLLMLanguageInstruction } from "../../i18n/backend";
import { Course } from "../egela/Course";
import { AssistantConfig } from "./AssistantConfig";
import { OpenAIService } from "./OpenAIService";
import { ToolFunctions } from "./ToolFunctions";

export { BaseAssistant };

/**
 * Base class for AI assistants
 * Provides common functionality to handle courses and build modular prompts
 */
abstract class BaseAssistant {
    protected course: Course | null = null;
    protected openAIService: OpenAIService;
    protected config: AssistantConfig;
    protected allowedTools: string[] = [];

    constructor(config: AssistantConfig, allowedTools: string[]) {
        this.openAIService = new OpenAIService();
        this.config = config;
        this.allowedTools = allowedTools;
    }

    public setCourse(course: Course): void {
        this.course = course;
    }

    /**
     * Builds a prompt by substituting variables in a template
     * Variables are specified with the syntax {variable_name}
     * @param template Prompt template with {variable} markers
     * @param variables Object with variable values to substitute
     * @returns The prompt with substituted variables
     */
    protected buildPromptFromTemplate(template: string, variables: Record<string, string>): string {
        let result = template;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, value);
        }

        return result;
    }

    /**
     * Builds the teacher personalization section for prompts.
     * Includes teacher name and verbal tics to make feedback more familiar.
     * @returns Formatted personalization section or empty string if not configured
     */
    protected buildTeacherPersonalization(): string {
        const teacherName = this.config.common.teacherName;
        const teacherTics = this.config.common.teacherTics;

        if (!teacherName && !teacherTics) {
            return '';
        }

        let personalization = 'TEACHER PERSONALIZATION:';
        if (teacherName) {
            personalization += `\n- When suggesting the student to ask the teacher for help, use the name "${teacherName}" instead of generic terms like "the teacher" or "your instructor". For example: "You could ask ${teacherName} for more exercises to practise...".`;
        }
        if (teacherTics) {
            personalization += `\n- To make your feedback feel more familiar and natural, occasionally integrate some of the teacher's common expressions (verbal tics): ${teacherTics}. Use them sparingly and naturally - don't overuse them.`;
        }
        return personalization;
    }

    /**
     * Builds the language instruction for prompts.
     * Ensures the LLM responds in the user's selected language.
     * @returns Formatted language instruction
     */
    protected buildLanguageInstruction(): string {
        return `LANGUAGE REQUIREMENT:\n${getLLMLanguageInstruction()}`;
    }

    /**
     * Tool executor shared by all assistants
     * Provides access to getSectionContent, getPageContent, getResourceContent, explainExercise, solveExercise, getFilteredFileContent, and analyzeImage
     */
    protected async executeToolCall(
        name: string,
        args: any
    ): Promise<string> {
        if (!this.allowedTools.includes(name)) {
            throw new Error(`The assistant does not have access to the tool: ${name}`);
        }
        switch (name) {
            case 'getSectionContent':
                return await ToolFunctions.getSectionContent(this.course!, args);
            case 'getPageContent':
                return await ToolFunctions.getPageContent(this.course!, args);
            case 'getResourceContent':
                return await ToolFunctions.getResourceContent(this.course!, args);
            case 'explainExercise':
                return await ToolFunctions.explainExercise(args);
            case 'solveExercise':
                return await ToolFunctions.solveExercise(args);
            case 'getFilteredFileContent':
                return ToolFunctions.getFilteredFileContent(args);
            case 'analyzeImage':
                return await ToolFunctions.analyzeImage(args);
            case 'postExercises':
                throw new Error('postExercises must be handled directly by the assistant');
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
}
