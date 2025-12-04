import { Course } from "../egela/Course";
import { AssistantConfig } from "./AssistantConfig";
import { OpenAIService } from "./OpenAIService";
import { ToolFunctions } from "./ToolFunctions";

export { BaseAssistant };

/**
 * Clase base para asistentes de IA
 * Proporciona funcionalidad común para manejar cursos y construir prompts modulares
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
     * Construye un prompt sustituyendo variables en una plantilla
     * Las variables se especifican con la sintaxis {nombre_variable}
     * @param template Plantilla de prompt con marcadores {variable}
     * @param variables Objeto con los valores de las variables a sustituir
     * @returns El prompt con las variables sustituidas
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
     * Ejecutor de herramientas compartido por todos los asistentes
     * Proporciona acceso a getSectionContent, getPageContent, getResourceContent, explainExercise, solveExercise y getFilteredFileContent
     */
    protected async executeToolCall(
        name: string,
        args: any
    ): Promise<string | { type: 'file'; data: any }> {
        if (!this.allowedTools.includes(name)) {
            throw new Error(`El asistente no tiene acceso a la herramienta: ${name}`);
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
                throw new Error('postExercises debe ser manejado directamente por el asistente');
            default:
                throw new Error(`Herramienta desconocida: ${name}`);
        }
    }
}
