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
    exercise_context: z.string().optional().nullable().describe("Contexto adicional relevante para los ejercicios (por ejemplo, script SQL de esquema de base de datos, especificaciones técnicas, etc.)"),
    concepts: z.array(z.string()).optional().nullable().describe("Lista de conceptos o instrucciones que se trabajan en los ejercicios de esta página"),
    learning_objectives: z.string().optional().nullable().describe("Descripción breve de los objetivos de aprendizaje o conceptos que se pretenden trabajar con estos ejercicios")
});

/**
 * Esquema para un paso de explicación
 */
export const StepSchema = z.object({
    explanation: z.string().describe("Explicación detallada del paso en formato Markdown. Cada paso se corresponde a un subproblema/paso de refinamiento sucesivo. Puede incluir tablas, código SQL, listas, etc.")
});

/**
 * Esquema para la explicación estructurada de un ejercicio
 */
export const ExplanationSchema = z.object({
    steps: z.array(StepSchema).describe("Lista ordenada de pasos para resolver el ejercicio. Cada paso debe ser claro y progresivo. Si el alumno ya ha completado ejercicios relacionados, reduce la verbosidad en conceptos básicos y enfócate en los aspectos nuevos o avanzados.")
});

/**
 * Esquema para la evaluación de una solución de ejercicio
 */
export const EvaluationSchema = z.object({
    score: z.number().min(0).max(10).describe("Puntuación de la solución sobre 10 puntos"),
    feedback: z.string().describe("Comentario detallado sobre la solución en formato Markdown. Debe incluir: qué está bien, qué está mal, sugerencias de mejora y explicación de errores si los hay.")
});

export type ExerciseSchemaType = z.infer<typeof ExerciseSchema>;
export type ExerciseListSchemaType = z.infer<typeof ExerciseListSchema>;
export type StepSchemaType = z.infer<typeof StepSchema>;
export type ExplanationSchemaType = z.infer<typeof ExplanationSchema>;
export type EvaluationSchemaType = z.infer<typeof EvaluationSchema>;
