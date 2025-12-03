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

    constructor(config: AssistantConfig) {
        this.openAIService = new OpenAIService();
        this.config = config;
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
        if (name === 'getSectionContent') {
            return await ToolFunctions.getSectionContent(this.course!, args);
        }

        if (name === 'getPageContent') {
            return await ToolFunctions.getPageContent(this.course!, args);
        }

        if (name === 'getResourceContent') {
            return await ToolFunctions.getResourceContent(this.course!, args);
        }

        if (name === 'explainExercise') {
            return await ToolFunctions.explainExercise(args);
        }

        if (name === 'solveExercise') {
            return await ToolFunctions.solveExercise(args);
        }

        if (name === 'getFilteredFileContent') {
            return ToolFunctions.getFilteredFileContent(args);
        }

        throw new Error(`Herramienta desconocida: ${name}`);
    }
}
