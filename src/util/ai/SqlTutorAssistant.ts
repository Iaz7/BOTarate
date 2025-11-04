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
     * @param dbSchema - Esquema de la base de datos (opcional)
     * @param sqlInstructions - Instrucciones SQL que se trabajan en la página (opcional)
     * @param learningObjectives - Objetivos de aprendizaje de la página (opcional)
     * @returns Explicación estructurada con pasos
     */
    async generateExplanation(
        exerciseName: string,
        exerciseStatement: string,
        dbSchema?: string,
        sqlInstructions?: string[],
        learningObjectives?: string
    ): Promise<ExplanationSchemaType> {
        console.log(`[generateExplanation] Generando explicación para: ${exerciseName}`);

        const courseContext = JSON.stringify(this.course);

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
- No asumas conocimientos avanzados del estudiante

CONTEXTO PEDAGÓGICO:
${sqlInstructions && sqlInstructions.length > 0 ? `- Este ejercicio trabaja las siguientes instrucciones SQL: ${sqlInstructions.join(', ')}` : ''}
${learningObjectives ? `- Objetivos de aprendizaje de la página: ${learningObjectives}` : ''}
${sqlInstructions || learningObjectives ? '- Asegúrate de que tu explicación se alinee con estos objetivos de aprendizaje y enfoque especialmente en las instrucciones SQL mencionadas.' : ''}

ACCESO A RECURSOS DEL CURSO:
Tienes acceso a las herramientas getSectionContent y getResourceContent para consultar material de teoría del curso.
- Si necesitas verificar qué conceptos se han explicado en clase, puedes consultar las secciones del curso
- Busca material relacionado con las instrucciones SQL que se trabajan en el ejercicio
- Prioriza explicar usando los conceptos que ya se han visto en clase
- Si un concepto no se ha dado en clase, menciónalo brevemente pero no lo uses como base de tu explicación

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones disponibles. Cada sección tiene un ID único que debes usar cuando necesites obtener su contenido detallado.

${courseContext}`;

    const userPrompt = `Por favor, genera una explicación paso a paso para el siguiente ejercicio:

**${exerciseName}**

${exerciseStatement}

${dbSchema ? `Esquema de la base de datos (SQL):\n\`\`\`sql\n${dbSchema}\n\`\`\`` : ''}

Antes de generar la explicación, considera consultar el material de teoría del curso para asegurarte de que tu explicación se alinea con lo que se ha enseñado en clase.`;

        try {
            // Reiniciar historial para esta llamada específica
            OpenAIService.resetConversation();
            
            // Usar la nueva función que permite tools con respuestas estructuradas
            const response = await OpenAIService.processStructuredWithTools(
                ExplanationSchema,
                "explanation",
                (name, args) => this.executeToolCall(name, args),
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
