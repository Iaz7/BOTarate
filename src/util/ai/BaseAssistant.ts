import { Course } from "../egela/Course";
import { ToolFunctions } from "./ToolFunctions";

export { BaseAssistant };

/**
 * Clase base para asistentes de IA
 * Proporciona funcionalidad común para manejar cursos
 */
abstract class BaseAssistant {
    protected course: Course | null = null;

    public setCourse(course: Course): void {
        this.course = course;
    }

    /**
     * Ejecutor de herramientas compartido por todos los asistentes
     * Proporciona acceso a getSectionContent, getPageContent y getResourceContent
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

        throw new Error(`Herramienta desconocida: ${name}`);
    }
}
