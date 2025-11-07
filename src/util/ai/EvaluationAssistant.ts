import { BaseAssistant } from "./BaseAssistant";
import { OpenAIService } from "./OpenAIService";
import { EvaluationSchema, EvaluationSchemaType } from "./schemas";

export { EvaluationAssistant };

/**
 * Asistente especializado en evaluar soluciones de ejercicios SQL
 */
class EvaluationAssistant extends BaseAssistant {

    /**
     * Evalúa una solución propuesta por el estudiante para un ejercicio SQL
     * @param exerciseName - Nombre del ejercicio
     * @param exerciseStatement - Enunciado completo del ejercicio
     * @param studentSolution - Solución propuesta por el estudiante (consulta SQL)
     * @param dbSchema - Esquema de la base de datos (opcional)
     * @param sqlInstructions - Instrucciones SQL que se trabajan en la página (opcional)
     * @param learningObjectives - Objetivos de aprendizaje de la página (opcional)
     * @returns Evaluación estructurada con puntuación y feedback
     */
    async evaluateSolution(
        exerciseName: string,
        exerciseStatement: string,
        studentSolution: string,
        dbSchema?: string,
        sqlInstructions?: string[],
        learningObjectives?: string
    ): Promise<EvaluationSchemaType> {
        console.log(`[evaluateSolution] Evaluando solución para: ${exerciseName}`);

        const systemPrompt = `Eres un evaluador experto en SQL que analiza y califica soluciones de ejercicios de bases de datos propuestas por estudiantes.

Tu tarea es evaluar consultas SQL proporcionadas por estudiantes, proporcionando:
1. Una puntuación objetiva sobre 10 puntos
2. Feedback constructivo y educativo

CRITERIOS DE EVALUACIÓN:

**Corrección Funcional (40%)**
- ¿La consulta produce el resultado correcto?
- ¿Responde exactamente a lo que pide el enunciado?
- ¿Maneja correctamente casos límite?

**Calidad Técnica (30%)**
- ¿Usa las instrucciones SQL apropiadas?
- ¿Es eficiente la solución?
- ¿Sigue buenas prácticas de SQL?
- ¿Hay errores de sintaxis?

**Claridad y Estilo (20%)**
- ¿Es legible el código?
- ¿Usa nombres de alias descriptivos?
- ¿Está bien estructurada la consulta?

**Alineación con Objetivos (10%)**
- ¿Utiliza los conceptos que se están enseñando?
- ¿Demuestra comprensión de los objetivos de aprendizaje?

ESCALA DE PUNTUACIÓN:
- **9-10**: Excelente - Solución correcta, eficiente y bien escrita
- **7-8**: Buena - Solución correcta con pequeños detalles mejorables
- **5-6**: Aceptable - Funciona pero tiene problemas de eficiencia o estilo
- **3-4**: Insuficiente - Errores significativos o solución parcial
- **0-2**: Muy deficiente - Solución incorrecta o no funcional

FORMATO DEL FEEDBACK:
- Comienza con un resumen breve (1-2 líneas)
- Usa formato Markdown para estructura clara
- Sé específico: señala líneas o partes concretas del código
- Usa bloques de código SQL SOLO para consultas/subconsultas completas con \`\`\`sql
- Para nombres de tablas, columnas o funciones sueltos, USA NEGRITA
- Sé constructivo: siempre menciona qué está bien antes de los errores
- Proporciona ejemplos de mejora cuando sea relevante
${dbSchema ? '- Puedes usar el esquema y los datos de ejemplo para ilustrar problemas' : ''}
- Si hay errores de sintaxis, explícalos claramente
- Si la consulta es incorrecta funcionalmente, explica por qué y qué debería hacer

CONTEXTO PEDAGÓGICO:
${sqlInstructions && sqlInstructions.length > 0 ? `- Este ejercicio trabaja las siguientes instrucciones SQL: ${sqlInstructions.join(', ')}` : ''}
${learningObjectives ? `- Objetivos de aprendizaje: ${learningObjectives}` : ''}
${sqlInstructions || learningObjectives ? '- Considera estos objetivos al evaluar si el estudiante usa las técnicas apropiadas.' : ''}

IMPORTANTE:
- Sé justo pero honesto en la evaluación
- Si la solución es correcta, reconócelo claramente
- Si hay errores, explícalos de manera que el estudiante pueda aprender
- No des la solución completa, pero guía hacia la respuesta correcta
- Mantén un tono educativo y motivador`;

        const userPrompt = `Por favor, evalúa la siguiente solución propuesta por un estudiante:

**Ejercicio: ${exerciseName}**

${exerciseStatement}

${dbSchema ? `**Esquema de la base de datos (SQL):**\n\`\`\`sql\n${dbSchema}\n\`\`\`` : ''}

**Solución del estudiante:**
\`\`\`sql
${studentSolution}
\`\`\`

Proporciona una evaluación completa con puntuación y feedback detallado.`;

        try {
            // Reiniciar historial para esta llamada específica
            OpenAIService.resetConversation();

            // Usar la función que permite respuestas estructuradas
            const response = await OpenAIService.generateStructuredResponse(
                EvaluationSchema,
                "evaluation",
                userPrompt,
                systemPrompt
            );

            console.log(`[evaluateSolution] Evaluación generada con puntuación: ${response.score}/10`);
            return response;

        } catch (error) {
            console.error(`[evaluateSolution] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al evaluar solución: ${error.message}`);
            }
            throw new Error('Error desconocido al evaluar solución');
        }
    }
}
