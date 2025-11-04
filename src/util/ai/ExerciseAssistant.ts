import { Exercise } from "../egela/Exercise";
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
            const pageResult = await this.course.getPageContent(pageId);
            const pageContent = pageResult.markdown;
            const attachedFiles = pageResult.files;
            console.log(`[identifyExercises] Contenido de la página obtenido (${pageContent.length} caracteres), archivos: ${attachedFiles.length}`);

            // 2. Obtener contexto del curso
            const courseContext = JSON.stringify(this.course);

            // 3. Construir el prompt para el LLM con acceso a tools
            const systemPrompt = `Eres un asistente experto en identificar ejercicios académicos en páginas educativas y analizar su contexto pedagógico.

ACCESO A RECURSOS DEL CURSO:
Tienes acceso a las herramientas getSectionContent y getResourceContent para consultar material del curso.
${resourceId ? `
UBICACIÓN DE LOS EJERCICIOS:
- Los ejercicios que estás analizando están en el recurso con ID: ${resourceId}
- Los recursos (diapositivas, ejercicios, etc.) aparecen en ORDEN dentro de las secciones del curso
- Las diapositivas de teoría relacionadas con estos ejercicios CASI SIEMPRE están inmediatamente ANTES de este recurso en la lista
- Busca en la estructura del curso el recurso ${resourceId} para ver qué recursos vienen antes
- Los recursos anteriores (especialmente PDFs de diapositivas) contienen la teoría que debes revisar

⚠️ OBLIGATORIO - ANTES DE ANALIZAR LOS EJERCICIOS:
1. Localiza el recurso ${resourceId} en la estructura del curso
2. Identifica los recursos (especialmente PDFs) que vienen INMEDIATAMENTE ANTES en la misma sección
3. USA la herramienta getResourceContent para consultar esos recursos (las diapositivas de teoría)
4. Analiza el contenido de las diapositivas para entender qué conceptos SQL se han explicado
5. Usa esa información para determinar las instrucciones SQL y objetivos de aprendizaje
` : ''}

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones y recursos. Cada sección y recurso tiene un ID único.

${courseContext}

ADVERTENCIA SOBRE ARCHIVOS:
- En el markdown que recibirás pueden aparecer marcas como [FILE1], [FILE2], etc. Esos marcadores representan archivos adjuntos que corresponden a la posición en la página donde estaba el archivo (imagen, SQL, PDF, etc.).
- Cuando encuentres un marcador [FILEn], consulta el archivo adjunto con ese índice. Si es una imagen que contiene una tabla, conviértela a formato Markdown si es posible. Si es un fichero de texto (SQL, MD, TXT), utiliza su contenido para completar el enunciado.

TU TAREA:
Analiza el contenido de la página proporcionado y:
1. Identifica todos los ejercicios presentes
2. Extrae el esquema de base de datos si existe
3. Identifica las instrucciones SQL que se trabajan en los ejercicios (BASÁNDOTE EN LAS DIAPOSITIVAS PREVIAS)
4. Determina los objetivos de aprendizaje de la página (BASÁNDOTE EN LAS DIAPOSITIVAS PREVIAS)

CRITERIOS PARA IDENTIFICAR EJERCICIOS:
- La página puede no contener ejercicios. Es posible que la página solo tenga material de lectura para los alumnos. En este caso devuelve un array vacío.
- Busca patrones como "EJERCICIO", "Ejercicio", "Pregunta", etc.
- Un ejercicio típicamente tiene un identificador (número o nombre) y un enunciado. En algunos casos se incluye una tabla con el resultado esperado
- El enunciado puede incluir tablas, descripciones, o preguntas específicas
- Si hay tablas asociadas a un ejercicio, inclúyelas en el enunciado en formato Markdown. Las tablas pueden venir en formato Markdown o en formato texto. Debes identificar cuando hay una tabla y convertirla a formato Markdown para incluirla en el enunciado

ESQUEMA DE BASE DE DATOS:
- Si en la página observas un script SQL o un bloque que describe el esquema de la base de datos (por ejemplo instrucciones CREATE TABLE, CREATE INDEX, etc.), extrae ese script completo y devuélvelo en el campo "db_schema". El script debe ser el SQL necesario para recrear el esquema de la base de datos relacionado con los ejercicios de la página. Si no detectas tal script o información, devuelve el campo "db_schema" vacío o no lo incluyas.

INSTRUCCIONES SQL:
- Analiza los ejercicios e identifica qué instrucciones, cláusulas o conceptos SQL se pretenden trabajar
- REVISA LAS DIAPOSITIVAS PREVIAS para ver qué conceptos se han explicado en teoría
- Devuelve estas instrucciones en el campo "sql_instructions" como un array de strings
- Sé específico: si se trabajan diferentes tipos de JOIN, especifícalos por separado
- Ejemplos: 'SELECT', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'Subconsultas', 'Funciones de agregación', 'DISTINCT', 'COUNT', 'SUM', 'AVG', etc.
- Si no hay ejercicios, este campo debe estar vacío

OBJETIVOS DE APRENDIZAJE:
- Basándote en los ejercicios, su contenido Y LAS DIAPOSITIVAS PREVIAS, infiere cuál es el objetivo pedagógico de la página
- Escribe una descripción breve (1-3 frases) en el campo "learning_objectives"
- Ejemplo: "Practicar consultas con múltiples tablas usando diferentes tipos de JOIN y entender cuándo usar cada uno."
- Si no hay ejercicios, este campo debe estar vacío

IMPORTANTE:
- Si NO hay ejercicios en la página, devuelve un array vacío en el campo "exercises" y los campos sql_instructions y learning_objectives vacíos
- Si SÍ hay ejercicios, incluye cada uno con su "name" (identificador) y "statement" (enunciado completo)
- Si ves texto que podría representar una tabla, conviértelo a formato Markdown al incluirlo en el enunciado
`;

            const userPrompt = `Analiza el siguiente contenido de una página educativa e identifica los ejercicios, el esquema de base de datos si existe, las instrucciones SQL que se trabajan y los objetivos de aprendizaje.

${resourceId ? '⚠️ RECUERDA: Debes consultar OBLIGATORIAMENTE las diapositivas de teoría que vienen antes de este recurso en el curso antes de identificar las instrucciones SQL y objetivos de aprendizaje.\n\n' : ''}Contenido de la página:

${pageContent}`;

            // 4. Generar respuesta estructurada usando tools
            // Reiniciar historial para esta llamada específica para evitar mezclar contexto previo
            OpenAIService.resetConversation();
            const response = await OpenAIService.processStructuredWithTools(
                ExerciseListSchema,
                "exercise_list",
                (name, args) => this.executeToolCall(name, args),
                userPrompt,
                systemPrompt,
                attachedFiles
            );

            console.log(`[identifyExercises] Respuesta estructurada recibida:`, response);

            // 5. Convertir a objetos Exercise
            const exercises: Exercise[] = (response.exercises || []).map(
                (ex: { name: string; statement: string }) => new Exercise(ex.name, ex.statement)
            );

            console.log(`[identifyExercises] Se identificaron ${exercises.length} ejercicios, db_schema presente: ${!!response.db_schema}`);
            console.log(`[identifyExercises] Instrucciones SQL: ${response.sql_instructions?.join(', ') || 'N/A'}`);
            console.log(`[identifyExercises] Objetivos de aprendizaje: ${response.learning_objectives || 'N/A'}`);
            
            return { 
                exercises, 
                dbSchema: response.db_schema,
                sqlInstructions: response.sql_instructions,
                learningObjectives: response.learning_objectives
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
