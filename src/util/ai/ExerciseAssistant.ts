import { Exercise } from "../egela/Exercise";
import { ExerciseStorageManager } from "../storage/ExerciseStorageManager";
import { BaseAssistant } from "./BaseAssistant";
import { OpenAIService } from "./OpenAIService";
import { ExerciseListSchema } from "./schemas";

export { ExerciseAssistant };

/**
 * Asistente para análisis de ejercicios
 * Maneja la identificación y análisis de ejercicios en páginas del curso
 */
class ExerciseAssistant extends BaseAssistant {

    /**
     * Identifica los ejercicios en una página usando el LLM con respuestas estructuradas
     * @param pageId ID de la página de Egela
     * @param resourceId ID del recurso (para ubicarlo en la lista de recursos de la sección)
     * @returns Array de ejercicios identificados (vacío si no hay ejercicios), esquema de BD y contexto pedagógico
     */
    async identifyExercises(pageId: string, resourceId?: string): Promise<{
        exercises: Exercise[];
        dbSchema?: string;
        sqlInstructions?: string[];
        learningObjectives?: string;
    }> {
        console.log(`[identifyExercises] Identificando ejercicios en página: ${pageId}`);

        try {
            // 1. Obtener el contenido de la página en formato Markdown + archivos detectados
            const pageResult = await this.course!.getPageContent(pageId);
            const pageContent = pageResult.markdown;
            const attachedFiles = pageResult.files;
            console.log(`[identifyExercises] Contenido de la página obtenido (${pageContent.length} caracteres), archivos: ${attachedFiles.length}`);

            // 2. Obtener contexto del curso
            const courseContext = JSON.stringify(this.course);

            // 3. Construir el system prompt único que explica ambas fases
            const systemPrompt = `Eres un asistente experto en identificar ejercicios académicos en páginas educativas y analizar su contexto pedagógico.

FLUJO DE TRABAJO EN 2 FASES:
Este proceso se realizará en dos fases dentro de la misma conversación:
- FASE 1: Recopilación de información usando herramientas (getSectionContent, getResourceContent)
- FASE 2: Generación de respuesta estructurada con toda la información recopilada

La información obtenida en la FASE 1 se mantiene en el historial y estará disponible para la FASE 2.

ACCESO A RECURSOS DEL CURSO:
Tienes acceso a las herramientas getSectionContent, getPageContent y getResourceContent para consultar material del curso.
${resourceId ? `
UBICACIÓN DE LOS EJERCICIOS:
- Los ejercicios que estás analizando están en el recurso con ID: ${resourceId}
- Los recursos (diapositivas, ejercicios, etc.) aparecen en ORDEN dentro de las secciones del curso
- Las diapositivas de teoría relacionadas con estos ejercicios CASI SIEMPRE están inmediatamente ANTES de este recurso en la lista
- Busca en la estructura del curso el recurso ${resourceId} para ver qué recursos vienen antes
- Los recursos anteriores (especialmente PDFs de diapositivas) contienen la teoría que debes revisar

OBLIGATORIO - EN LA FASE 1:
1. Localiza el recurso ${resourceId} en la estructura del curso
2. Identifica los recursos (especialmente PDFs) que vienen INMEDIATAMENTE ANTES en la misma sección
3. USA la herramienta getResourceContent para consultar esos recursos (las diapositivas de teoría)
4. Analiza el contenido de las diapositivas para entender qué conceptos SQL se han explicado
5. Responde brevemente confirmando qué información has recopilado
6. Identifica las páginas de los laboratorios realizados antes que el actual
7. Usa getPageContent para consultar esas páginas de laboratorios previos y entender sus objetivos pedagógicos. Los objetivos que establezcas deberían incluir también los de estos laboratorios anteriores 
` : ''}

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones y recursos. Cada sección y recurso tiene un ID único.

${courseContext}

ADVERTENCIA SOBRE ARCHIVOS:
- En el markdown que recibirás pueden aparecer marcas como [FILE1], [FILE2], etc. Esos marcadores representan archivos adjuntos que corresponden a la posición en la página donde estaba el archivo (imagen, SQL, PDF, etc.).
- Cuando encuentres un marcador [FILEn], consulta el archivo adjunto con ese índice. Si es una imagen que contiene una tabla, conviértela a formato Markdown si es posible. Si es un fichero de texto (SQL, MD, TXT), utiliza su contenido para completar el enunciado.

CRITERIOS PARA IDENTIFICAR EJERCICIOS (FASE 2):
- La página puede no contener ejercicios. Es posible que la página solo tenga material de lectura para los alumnos. En este caso devuelve un array vacío.
- Busca patrones como "EJERCICIO", "Ejercicio", "Pregunta", etc.
- Un ejercicio típicamente tiene un identificador (número o nombre) y un enunciado. En algunos casos se incluye una tabla con el resultado esperado
- El enunciado puede incluir tablas, descripciones, o preguntas específicas
- Si hay tablas asociadas a un ejercicio, inclúyelas en el enunciado en formato Markdown. 
- IMPORTANTE: Las tablas pueden venir en formato texto plano. Debes identificar cuando hay una tabla (buscando patrones como líneas de -, valores separados por espacios, saltos de línea...) y convertirla a tabla en formato Markdown para incluirla en el enunciado. Por ejemplo:

el texto DNI NOMBRE
72515671 Jon Zatarain 72515672 Javier Cosin 72515673 Bienvenido Atetxe 75646464 Iker Pujol 88888888 Maite Artola
representa una tabla que debe convertirse a:
| DNI       | NOMBRE          |
|-----------|-----------------|
| 72515671  | Jon Zatarain    |
| 72515672  | Javier Cosin    |
| 72515673  | Bienvenido Atetxe|
| 75646464  | Iker Pujol      |
| 88888888  | Maite Artola    |

ESQUEMA DE BASE DE DATOS (FASE 2):
- Si en la página observas un script SQL o un bloque que describe el esquema de la base de datos (por ejempl
o instrucc
iones CREATE TABLE, CREATE INDEX, etc.), extrae ese script completo y devuélvelo en el campo "db_schema"
- Si no dectas tal script o información, devuelve el campo "db_schema" vacío

INSTRUCCIONES SQL (FASE 2):
- Analiza los ejercicios e identifica qué instrucciones, cláusulas o conceptos SQL se pretenden trabajar
- Usa la información de las diapositivas previas que consultaste en la FASE 1
- Devuelve estas instrucciones en el campo "sql_instructions" como un array de strings
- Sé específico: si se trabajan diferentes tipos de JOIN, especifícalos por separado
- Ejemplos: 'SELECT', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'Subconsultas', 'Funciones de agregación', 'DISTINCT', 'COUNT', 'SUM', 'AVG', etc.
- Si no hay ejercicios, este campo debe estar vacío

OBJETIVOS DE APRENDIZAJE (FASE 2):
- Basándote en los ejercicios, su contenido y las diapositivas previas que consultaste, infiere cuál es el objetivo pedagógico de la página
- Escribe una descripción breve (1-3 frases) en el campo "learning_objectives"
- Ejemplo: "Practicar consultas con múltiples tablas usando diferentes tipos de JOIN y entender cuándo usar cada uno."
`;

            const userPromptPhase1 = `FASE 1: RECOPILACIÓN DE INFORMACIÓN

Analiza el siguiente contenido de una página educativa. Por favor, recopila toda la información necesaria consultando los recursos del curso que consideres relevantes.

${resourceId ? '⚠️ RECUERDA: Debes consultar OBLIGATORIAMENTE las diapositivas de teoría que vienen antes de este recurso en el curso.\n\n' : ''}Contenido de la página:

${pageContent}`;

            // 4. FASE 1: Generar respuesta con tools (permitir al LLM consultar recursos)
            // NO resetear la conversación para mantener el historial entre fases
            OpenAIService.resetConversation();
            console.log(`[identifyExercises] FASE 1: Iniciando recopilación de información con tools`);

            // Permitir que el LLM use tools para consultar recursos adicionales
            // Los archivos adjuntos se pasan aquí para que el LLM pueda ver el contenido de la página
            await OpenAIService.processResponseWithTools(
                (name, args) => this.executeToolCall(name, args),
                userPromptPhase1,
                systemPrompt,
            );

            console.log(`[identifyExercises] FASE 1 completada. El LLM ha recopilado la información necesaria.`);

            // 5. FASE 2: Generar respuesta estructurada 
            // El LLM ya tiene toda la información en el historial de conversación
            const userPromptPhase2 = `FASE 2: GENERACIÓN DE RESPUESTA ESTRUCTURADA

Basándote en toda la información que has recopilado en la fase anterior, genera ahora la respuesta estructurada con:
1. Todos los ejercicios identificados en la página
2. El esquema de base de datos si existe
3. Las instrucciones SQL que se trabajan en los ejercicios
4. Los objetivos de aprendizaje de la página`;

            console.log(`[identifyExercises] FASE 2: Generando respuesta estructurada`);

            // NO pasar systemPrompt aquí porque ya está en el historial
            const response = await OpenAIService.generateStructuredResponse(
                ExerciseListSchema,
                "exercise_list",
                userPromptPhase2,
                "" // System prompt vacío porque ya está en el historial
            );

            console.log(`[identifyExercises] Respuesta estructurada recibida:`, response);

            // 5. Convertir a objetos Exercise
            const exercises: Exercise[] = (response.exercises || []).map(
                (ex: { name: string; statement: string }) => new Exercise(ex.name, ex.statement)
            );

            console.log(`[identifyExercises] Se identificaron ${exercises.length} ejercicios, db_schema presente: ${!!response.db_schema}`);
            console.log(`[identifyExercises] Instrucciones SQL: ${response.sql_instructions?.join(', ') || 'N/A'}`);
            console.log(`[identifyExercises] Objetivos de aprendizaje: ${response.learning_objectives || 'N/A'}`);

            // 6. Guardar los datos en el storage para uso futuro
            const exerciseDataToStore = exercises.map(ex => ({ name: ex.name, statement: ex.statement }));
            await ExerciseStorageManager.saveExerciseData(
                pageId,
                exerciseDataToStore,
                response.db_schema || '',
                response.sql_instructions || [],
                response.learning_objectives || ''
            );
            console.log(`[identifyExercises] Datos guardados en storage para página ${pageId}`);

            return {
                exercises,
                dbSchema: response.db_schema || undefined,
                sqlInstructions: response.sql_instructions || [],
                learningObjectives: response.learning_objectives || undefined,
            };

        } catch (error) {
            console.error(`[identifyExercises] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al identificar ejercicios: ${error.message}`);
            }
            throw new Error('Error desconocido al identificar ejercicios');
        }
    }
}
