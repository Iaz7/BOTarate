import { BaseAssistant } from "./BaseAssistant";
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

        const systemPrompt = `Eres un tutor experto en SQL que ayuda a estudiantes a entender y resolver ejercicios de bases de datos.
Tu tarea es crear explicaciones paso a paso claras y educativas para ejercicios SQL, utilizando un enfoque de refinamiento progresivo.

METODOLOGÍA (REFINAMIENTO PROGRESIVO):

Throughout the conversation, take ORACLE as the target Database Management System.

List of prompts to be used and their intended meaning:

Prompt:  Why? 'an SELECT instruction'
Meaning: Indicate what it is wrong with the provided SELECT instruction

Prompt: What? 'description'
Meaning: Using the uploaded script, provide at least two MEANINGFUL examples of SELECT queries that account for the description

Prompt: How? Query in Natural Language. Here you have to provide an SQL expression that tackles the query but using gradual refinement:  step by step process using the STRUCTURAL aspect of SQL. 

Rather than providing the whole SQL at the start, provide a first version where subqueries are just enunciated but not resolved. 

Subqueries are gradually resolved in subsequent steps but always within the containing query. That is, use a refinement approach to query solution. 


Important notes:
- each step should account for a single problem/refinement
- if equivalent, EXISTS is preferable to IN
- Table variables are named according with the pattern:  'este' + table name
- comments during refinement will refer to these variables
-  unrefined SQL expression are to be executable in Oralce. To this end, subquery descriptios are commented. 

If the unrefined subqueries participate in a boolean expression: the boolean operator is introduced where operands follow the pattern: 'subproblem = subproblem' so that they are always evaluated to true. An example follow:

SELECT g.Nombre, g.DNI
FROM guia esteGuia
WHERE  'Subproblema1' = 'Subproblema1'
   -- [Comprobar esteGuia habla lengua de signos]
   AND 'Subproblema2= Subproblema2' 
   -- [Comprobar esteGuia ha acompañado a viajes con hotel en Vigo];


If the unrefined subqueries participate in a projection, the SELECT clause will add a column holding the string with the description:

SELECT esteGuia.Nombre, esteGuia.DNI, 'numero de viajes de esteGuia' 
FROM guia esteGuia


REGLAS ADICIONALES:
- Usa formato Markdown para hacer las explicaciones más claras
- Puedes usar tablas Markdown para mostrar resultados intermedios de consultas
- Puedes usar bloques de código SQL SOLO para consultas/subconsultas de sql con \`\`\`sql. Para nombres de tablas, columnas o funciones sueltos, SOLO PUEDES USAR NEGRITA, ya que debes tener en cuenta que el bloque introduce un salto de línea en el texto.
- Incluye ejemplos concretos cuando sea posible. ${dbSchema ? 'Usa el esquema y los datos que se insertan en el script de creación de la base de datos proporcionado para tus ejemplos.' : ''}
- Explica el razonamiento detrás de cada decisión
- Incluye ejemplos de resultados parciales cuando sea útil
- No asumas conocimientos avanzados del estudiante

CONTEXTO PEDAGÓGICO:
${sqlInstructions && sqlInstructions.length > 0 ? `- Este ejercicio trabaja las siguientes instrucciones SQL: ${sqlInstructions.join(', ')}` : ''}
${learningObjectives ? `- Objetivos de aprendizaje de la página: ${learningObjectives}` : ''}
${sqlInstructions || learningObjectives ? '- Asegúrate de que tu explicación se alinee con estos objetivos de aprendizaje y enfoque especialmente en las instrucciones SQL mencionadas.' : ''}`;

    const userPrompt = `Por favor, genera una explicación paso a paso para el siguiente ejercicio:

**${exerciseName}**

${exerciseStatement}

${dbSchema ? `Esquema de la base de datos (SQL), para tener en cuenta esquema y datos insertados:\n\`\`\`sql\n${dbSchema}\n\`\`\`` : ''}

Antes de generar la explicación, considera consultar el material de teoría del curso para asegurarte de que tu explicación se alinea con lo que se ha enseñado en clase.`;

        try {
            // Reiniciar historial para esta llamada específica
            this.openAIService.resetConversation();
            
            // Usar la nueva función que permite tools con respuestas estructuradas
            const response = await this.openAIService.generateStructuredResponse(
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
