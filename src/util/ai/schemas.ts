import { z } from "zod";

/**
 * Esquema para un ejercicio individual
 */
export const ExerciseSchema = z.object({
    name: z.string().describe("El nombre o identificador del ejercicio (ej: 'Ejercicio 2.1')"),
    statement: z.string().describe("El enunciado completo del ejercicio, incluyendo tablas y contexto relevante en formato Markdown")
});

/**
 * Esquema para la respuesta de identificación de ejercicios
 */
export const ExerciseListSchema = z.object({
    exercises: z.array(ExerciseSchema).describe("Lista de ejercicios identificados en la página. Array vacío si no hay ejercicios."),
    db_schema: z.string().optional().nullable().describe("Script SQL para crear el esquema de la base de datos relacionado con la página, si se detecta"),
    sql_instructions: z.array(z.string()).optional().nullable().describe("Lista de instrucciones o cláusulas SQL que se trabajan en los ejercicios de esta página (ej: 'SELECT', 'JOIN', 'GROUP BY', 'HAVING', 'Subconsultas', 'ORDER BY', etc.)"),
    learning_objectives: z.string().optional().nullable().describe("Descripción breve de los objetivos de aprendizaje o conceptos que se pretenden trabajar con estos ejercicios")
});

/**
 * Esquema para un paso de explicación
 */
export const StepSchema = z.object({
    explanation: z.string().describe("Explicación detallada del paso en formato Markdown. Puede incluir tablas, código SQL, listas, etc.")
});

/**
 * Esquema para la explicación estructurada de un ejercicio
 */
export const ExplanationSchema = z.object({
    steps: z.array(StepSchema).describe("Lista ordenada de pasos para resolver el ejercicio. Cada paso debe ser claro y progresivo.")
});

export type ExerciseSchemaType = z.infer<typeof ExerciseSchema>;
export type ExerciseListSchemaType = z.infer<typeof ExerciseListSchema>;
export type StepSchemaType = z.infer<typeof StepSchema>;
export type ExplanationSchemaType = z.infer<typeof ExplanationSchema>;
