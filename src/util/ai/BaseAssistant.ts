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
     * Tool executor shared by all assistants
     * Provides access to getSectionContent, getPageContent, getResourceContent, explainExercise, solveExercise, and getFilteredFileContent
     */
    protected async executeToolCall(
        name: string,
        args: any
    ): Promise<string | { type: 'file'; data: any }> {
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
            case 'postExercises':
                // return ToolFunctions.postExercises(args);
                throw new Error('postExercises must be handled directly by the assistant');
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
}
