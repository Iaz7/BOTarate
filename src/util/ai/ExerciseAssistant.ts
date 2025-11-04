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
     * @returns Array de ejercicios identificados (vacío si no hay ejercicios)
     */
    async identifyExercises(pageId: string): Promise<{ exercises: Exercise[]; dbSchema?: string }> {
        this.ensureCourseLoaded();

        console.log(`[identifyExercises] Identificando ejercicios en página: ${pageId}`);

        try {
            // 1. Obtener el contenido de la página en formato Markdown + archivos detectados
            const pageResult = await this.course!.getPageContent(pageId);
            const pageContent = pageResult.markdown;
            const attachedFiles = pageResult.files;
            console.log(`[identifyExercises] Contenido de la página obtenido (${pageContent.length} caracteres), archivos: ${attachedFiles.length}`);

            // 2. Construir el prompt para el LLM (avisando sobre marcas [FILEn])
            const systemPrompt = `Eres un asistente experto en identificar ejercicios académicos en páginas educativas.

ADVERTENCIA SOBRE ARCHIVOS:
- En el markdown que recibirás pueden aparecer marcas como [FILE1], [FILE2], etc. Esos marcadores representan archivos adjuntos que corresponden a la posición en la página donde estaba el archivo (imagen, SQL, PDF, etc.).
- Cuando encuentres un marcador [FILEn], consulta el archivo adjunto con ese índice. Si es una imagen que contiene una tabla, conviértela a formato Markdown si es posible. Si es un fichero de texto (SQL, MD, TXT), utiliza su contenido para completar el enunciado.

TU TAREA:
Analiza el contenido de la página proporcionado y identifica todos los ejercicios presentes.

ADICIONAL: Si en la página observas un script SQL o un bloque que describe el esquema de la base de datos (por ejemplo instrucciones CREATE TABLE, CREATE INDEX, etc.), extrae ese script completo y devuélvelo en el campo "db_schema". El script debe ser el SQL necesario para recrear el esquema de la base de datos relacionado con los ejercicios de la página. Si no detectas tal script o información, devuelve el campo "db_schema" vacío o no lo incluyas.

CRITERIOS PARA IDENTIFICAR EJERCICIOS:
- La página puede no contener ejercicios. Es posible que la página solo tenga material de lectura para los alumnos. En este caso devuelve un array vacío.
- Busca patrones como "EJERCICIO", "Ejercicio", "Pregunta", etc.
- Un ejercicio típicamente tiene un identificador (número o nombre) y un enunciado. En algunos casos se incluye una tabla con el resultado esperado
- El enunciado puede incluir tablas, descripciones, o preguntas específicas
- Si hay tablas asociadas a un ejercicio, inclúyelas en el enunciado en formato Markdown. Las tablas pueden venir en formato Markdown o en formato texto. Debes identificar cuando hay una tabla y convertirla a formato Markdown para incluirla en el enunciado

IMPORTANTE:
- Si NO hay ejercicios en la página, devuelve un array vacío en el campo "exercises"
- Si SÍ hay ejercicios, incluye cada uno con su "name" (identificador) y "statement" (enunciado completo)
- Si ves texto que podría representar una tabla, conviértelo a formato Markdown al incluirlo en el enunciado
`;

            const userPrompt = `Analiza el siguiente contenido de una página educativa e identifica los ejercicios:

${pageContent}`;

            // 3. Generar respuesta estructurada usando Zod. Adjuntamos los archivos detectados para que el modelo los consulte.
            // Reiniciar historial para esta llamada específica para evitar mezclar contexto previo
            OpenAIService.resetConversation();
            const response = await OpenAIService.generateStructuredResponse(
                ExerciseListSchema,
                "exercise_list",
                userPrompt,
                systemPrompt,
                attachedFiles
            );

            console.log(`[identifyExercises] Respuesta estructurada recibida:`, response);

            // 4. Convertir a objetos Exercise
            const exercises: Exercise[] = (response.exercises || []).map(
                (ex: { name: string; statement: string }) => new Exercise(ex.name, ex.statement)
            );

            console.log(`[identifyExercises] Se identificaron ${exercises.length} ejercicios, db_schema presente: ${!!response.db_schema}`);
            return { exercises, dbSchema: response.db_schema };

        } catch (error) {
            console.error(`[identifyExercises] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al identificar ejercicios: ${error.message}`);
            }
            throw new Error('Error desconocido al identificar ejercicios');
        }
    }
}
