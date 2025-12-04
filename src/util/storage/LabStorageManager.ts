import { BaseStorageManager } from "./BaseStorageManager";

/**
 * Niveles de verbosidad para las respuestas del asistente
 */
export type VerbosityLevel = "low" | "medium" | "high";

/**
 * Niveles de esfuerzo de razonamiento para el modelo
 */
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

/**
 * Estructura de datos de laboratorios
 */
export interface Lab {
    id: string;
    name: string;
    required: boolean;
    verbosity?: VerbosityLevel;
    reasoningEffort?: ReasoningEffort;
}

/**
 * Estructura de datos de laboratorios para el curso
 */
export interface LabData {
    courseId: string;
    labs: Lab[];
}

/**
 * Gestor de almacenamiento para laboratorios del curso
 * Guarda y recupera la lista de laboratorios configurados para el sistema de "niveles"
 */
export class LabStorageManager extends BaseStorageManager {
    private static readonly STORAGE_KEY_PREFIX = 'lab_data_';

    /**
     * Guarda la lista de laboratorios de un curso en el storage
     * @param courseId ID del curso
     * @param labs Lista de laboratorios
     */
    static async saveLabData(courseId: string, labs: Lab[]): Promise<void> {
        const data: LabData = {
            courseId,
            labs
        };

        await this.saveData(this.STORAGE_KEY_PREFIX, courseId, data);
    }

    /**
     * Recupera la lista de laboratorios de un curso del storage
     * @param courseId ID del curso
     * @returns Datos de laboratorios o null si no existen
     */
    static async getLabData(courseId: string): Promise<(LabData & { timestamp: number }) | null> {
        return await this.getData<LabData>(this.STORAGE_KEY_PREFIX, courseId);
    }

    /**
     * Elimina los datos de laboratorios de un curso del storage
     * @param courseId ID del curso
     */
    static async removeLabData(courseId: string): Promise<void> {
        await this.removeData(this.STORAGE_KEY_PREFIX, courseId);
    }

    /**
     * Limpia todos los datos de laboratorios almacenados
     */
    static async clearAllLabData(): Promise<void> {
        await this.clearAllData(this.STORAGE_KEY_PREFIX);
    }

    /**
     * Verifica si existen datos de laboratorios guardados para un curso
     * @param courseId ID del curso
     * @returns true si existen datos, false en caso contrario
     */
    static async hasLabData(courseId: string): Promise<boolean> {
        return await this.hasData(this.STORAGE_KEY_PREFIX, courseId);
    }

    /**
     * Actualiza el estado 'required' de un laboratorio específico
     * @param courseId ID del curso
     * @param labId ID del laboratorio
     * @param required Nuevo estado de requerido/opcional
     */
    static async updateLabRequired(courseId: string, labId: string, required: boolean): Promise<void> {
        const data = await this.getLabData(courseId);
        if (!data) {
            throw new Error(`No se encontraron datos de laboratorios para el curso ${courseId}`);
        }

        const lab = data.labs.find(l => l.id === labId);
        if (!lab) {
            throw new Error(`No se encontró el laboratorio ${labId}`);
        }

        lab.required = required;

        await this.saveLabData(courseId, data.labs);
    }

    /**
     * Actualiza el nivel de verbosidad de un laboratorio específico
     * @param courseId ID del curso
     * @param labId ID del laboratorio
     * @param verbosity Nivel de verbosidad
     */
    static async updateLabVerbosity(courseId: string, labId: string, verbosity: VerbosityLevel): Promise<void> {
        const data = await this.getLabData(courseId);
        if (!data) {
            throw new Error(`No se encontraron datos de laboratorios para el curso ${courseId}`);
        }

        const lab = data.labs.find(l => l.id === labId);
        if (!lab) {
            throw new Error(`No se encontró el laboratorio ${labId}`);
        }

        lab.verbosity = verbosity;

        await this.saveLabData(courseId, data.labs);
    }

    /**
     * Actualiza el esfuerzo de razonamiento de un laboratorio específico
     * @param courseId ID del curso
     * @param labId ID del laboratorio
     * @param reasoningEffort Nivel de esfuerzo de razonamiento
     */
    static async updateLabReasoningEffort(courseId: string, labId: string, reasoningEffort: ReasoningEffort): Promise<void> {
        const data = await this.getLabData(courseId);
        if (!data) {
            throw new Error(`No se encontraron datos de laboratorios para el curso ${courseId}`);
        }

        const lab = data.labs.find(l => l.id === labId);
        if (!lab) {
            throw new Error(`No se encontró el laboratorio ${labId}`);
        }

        lab.reasoningEffort = reasoningEffort;

        await this.saveLabData(courseId, data.labs);
    }

    /**
     * Obtiene la configuración de un laboratorio específico
     * @param courseId ID del curso
     * @param labId ID del laboratorio
     * @returns Configuración del laboratorio o null si no existe
     */
    static async getLabConfig(courseId: string, labId: string): Promise<Lab | null> {
        const data = await this.getLabData(courseId);
        if (!data) {
            return null;
        }

        return data.labs.find(l => l.id === labId) || null;
    }
}
