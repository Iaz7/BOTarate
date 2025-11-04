import { Course } from "../egela/Course";

export { BaseAssistant };

/**
 * Clase base para asistentes de IA
 * Proporciona funcionalidad común para manejar cursos
 */
abstract class BaseAssistant {
    protected course: Course | null = null;

    /**
     * Establece el curso actual para el asistente
     */
    setCourse(course: Course): void {
        this.course = course;
    }

    /**
     * Obtiene el curso actual
     */
    getCourse(): Course | null {
        return this.course;
    }

    /**
     * Verifica que haya un curso cargado
     * @throws Error si no hay curso cargado
     */
    protected ensureCourseLoaded(): void {
        if (!this.course) {
            throw new Error('No hay curso cargado');
        }
    }
}
