import { BaseAssistant } from "./BaseAssistant";
import { OpenAIService } from "./OpenAIService";
import { ExplanationSchema, ExplanationSchemaType } from "./schemas";

export { SqlTutorAssistant };

/**
 * Asistente especializado en generar explicaciones tutoriales para ejercicios SQL
 */
class SqlTutorAssistant extends BaseAssistant {
    /**
     * Genera una explicación estructurada paso a paso para un ejercicio
     * @param exerciseName - Nombre del ejercicio
     * @param exerciseStatement - Enunciado completo del ejercicio
     * @returns Explicación estructurada con pasos
     */
    async generateExplanation(
        exerciseName: string,
        exerciseStatement: string,
        dbSchema?: string
    ): Promise<ExplanationSchemaType> {
        console.log(`[generateExplanation] Generando explicación para: ${exerciseName}`);

        const systemPrompt = `Eres un tutor experto en SQL que ayuda a estudiantes a entender y resolver ejercicios de bases de datos.
Tu tarea es crear explicaciones paso a paso claras y educativas para ejercicios SQL.

IMPORTANTE:
- Desglosa la solución en pasos lógicos y progresivos
- Cada paso debe explicar UN concepto o acción específica
- Usa formato Markdown para hacer las explicaciones más claras
- Puedes usar tablas Markdown para mostrar resultados intermedios de consultas
- Puedes usar bloques de código SQL con \`\`\`sql
- Explica el razonamiento detrás de cada decisión
- Si el ejercicio involucra múltiples tablas, muestra cómo se relacionan
- Incluye ejemplos de resultados parciales cuando sea útil
- Mantén un tono educativo y amigable
- No asumas conocimientos avanzados del estudiante`;

    const userPrompt = `Por favor, genera una explicación paso a paso para el siguiente ejercicio:

**${exerciseName}**

${exerciseStatement}

${dbSchema ? `Esquema de la base de datos (SQL):\n${dbSchema}` : ''}

Crea una explicación estructurada que guíe al estudiante desde el análisis del problema hasta la solución completa.`;

        try {
            // Reiniciar historial para esta llamada específica
            OpenAIService.resetConversation();
            
            const response = await OpenAIService.generateStructuredResponse(
                ExplanationSchema,
                "explanation",
                userPrompt,
                systemPrompt
            );

            console.log(`[generateExplanation] Explicación generada con ${response.steps.length} pasos`);
            return response;

        } catch (error) {
            console.error(`[generateExplanation] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al generar explicación: ${error.message}`);
            }
            throw new Error('Error desconocido al generar explicación');
        }
    }
}
