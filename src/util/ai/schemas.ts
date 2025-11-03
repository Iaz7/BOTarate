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
    exercises: z.array(ExerciseSchema).describe("Lista de ejercicios identificados en la página. Array vacío si no hay ejercicios.")
});

export type ExerciseSchemaType = z.infer<typeof ExerciseSchema>;
export type ExerciseListSchemaType = z.infer<typeof ExerciseListSchema>;
