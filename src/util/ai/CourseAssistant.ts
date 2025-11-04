import { Course } from "../egela/Course";
import { Exercise } from "../egela/Exercise";
import { OpenAIService } from "./OpenAIService";
import { ExerciseListSchema } from "./schemas";

export { CourseAssistant };

/**
 * Servicio que integra OpenAI con el sistema de cursos de Egela
 * Maneja la lógica específica del asistente educativo
 */
class CourseAssistant {
    private course: Course | null = null;

    /**
     * Establece el curso actual para el asistente
     */
    setCourse(course: Course): void {
        this.course = course;
    }

    /**
     * Obtiene el curso actual
     */
    getCourse(): Course | null {
        return this.course;
    }

    /**
     * Construye el system prompt completo con información del curso
     */
    private buildSystemPrompt(): string {
        if (!this.course) {
            return 'Eres un asistente útil.';
        }

        const courseContext = JSON.stringify(this.course);
        
        return `Eres un asistente en una extensión de Chrome cuyo objetivo es ayudar a estudiantes con el contenido de sus cursos en Egela (plataforma educativa de la Universidad del País Vasco).

INSTRUCCIONES IMPORTANTES:
- Cuando el usuario mencione una sección por su título/nombre, busca su ID en la lista de sections anterior. El usuario no conoce los IDs, solo los títulos, así que NUNCA debes preguntarle el ID, sino buscarlo en la lista de secciones que se te proporciona al inicio. Si no sabes donde buscar, mira en todas las secciones hasta encontrar lo que buscas.
- Para obtener el contenido detallado de una sección, usa la herramienta getSectionContent con el ID de la sección
- Los IDs de las secciones son los valores del campo "id" (por ejemplo: "1378079")
- Si el usuario pide información sobre "la sección 2" o "tema 2", busca la sección con sectionNumber: 2 y usa su ID
- Responde de forma directa, útil y concisa
- Si necesitas información sobre una sección específica, llama a getSectionContent para obtenerla antes de responder
- Recuerda que NUNCA debes pedirle al usuario que te proporcione IDs, sino buscarlos tú mismo en la estructura del curso. El usuario no tiene esos IDs ni va a saber dártelos. La información que tienes es suficiente para encontrar los IDs necesarios.

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones disponibles. Cada sección tiene un ID único que debes usar cuando necesites obtener su contenido detallado.

${courseContext}`;
    }

    /**
     * Ejecutor de herramientas que delega al curso actual
     */
    private async executeCourseTool(
        name: string,
        args: any
    ): Promise<string | { type: 'file'; data: any }> {
        if (!this.course) {
            throw new Error('No hay curso cargado');
        }

        if (name === 'getSectionContent') {
            return await this.course.getSectionContent(args.sectionId);
        } 
        
        if (name === 'getResourceContent') {
            const fileData = await this.course.getResourceFile(args.resourceId);
            
            // Determinar si el archivo es compatible con la API
            const supportedMimeTypes = [
                'application/pdf',
                'image/png',
                'image/jpeg',
                'image/jpg',
                'image/gif',
                'image/webp',
                'text/html',
                'text/plain',
                'text/markdown'
            ];
            
            const isSupported = supportedMimeTypes.some(type => 
                fileData.mimeType.toLowerCase().includes(type.toLowerCase())
            );
            
            if (isSupported && (fileData.mimeType.startsWith('image/') || fileData.mimeType === 'application/pdf')) {
                // Para imágenes y PDFs, convertir a base64 y enviar como parte del mensaje
                const arrayBuffer = await fileData.blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // Convertir a base64 en chunks para evitar stack overflow
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                    binary += String.fromCharCode(...chunk);
                }
                const base64 = btoa(binary);
                const dataUrl = `data:${fileData.mimeType};base64,${base64}`;
                
                console.log(`[getResourceContent] PDF/Imagen convertido a base64, tamaño: ${base64.length} caracteres`);
                
                // Para PDFs e imágenes, devolver un objeto especial que indica que hay que adjuntar el archivo
                return {
                    type: 'file',
                    data: {
                        resourceName: fileData.resourceName,
                        filename: fileData.filename,
                        mimeType: fileData.mimeType,
                        size: fileData.size,
                        dataUrl: dataUrl
                    }
                };
            } else if (isSupported) {
                // Para texto/HTML, extraer contenido
                const text = await fileData.blob.text();
                return `Archivo: ${fileData.resourceName} (${fileData.filename})\nTipo: ${fileData.mimeType}\nTamaño: ${(fileData.size / 1024).toFixed(2)} KB\n\nCONTENIDO:\n${text}`;
            } else {
                // Formato no soportado, solo metadatos
                return JSON.stringify({
                    type: 'metadata_only',
                    resourceName: fileData.resourceName,
                    filename: fileData.filename,
                    mimeType: fileData.mimeType,
                    size: fileData.size,
                    message: `Archivo de tipo ${fileData.mimeType} - No se puede procesar el contenido directamente. Tamaño: ${(fileData.size / 1024 / 1024).toFixed(2)} MB`
                });
            }
        }
        
        throw new Error(`Herramienta desconocida: ${name}`);
    }

    /**
     * Genera una respuesta del asistente usando el curso actual
     * @param userMessage Mensaje del usuario
     * @param resetHistory Si es true, reinicia el historial de conversación
     * @returns La respuesta final del asistente
     */
    async generateResponse(userMessage: string, resetHistory: boolean = false): Promise<string> {
        if (resetHistory) {
            OpenAIService.resetConversation();
        }

        const systemPrompt = resetHistory ? this.buildSystemPrompt() : undefined;

        return await OpenAIService.processResponseWithTools(
            (name, args) => this.executeCourseTool(name, args),
            userMessage,
            systemPrompt
        );
    }

    /**
     * Identifica los ejercicios en una página usando el LLM con respuestas estructuradas
     * @param pageId ID de la página de Egela
     * @returns Array de ejercicios identificados (vacío si no hay ejercicios)
     */
    async identifyExercises(pageId: string): Promise<Exercise[]> {
        if (!this.course) {
            throw new Error('No hay curso cargado');
        }

        console.log(`[identifyExercises] Identificando ejercicios en página: ${pageId}`);

        try {
            // 1. Obtener el contenido de la página en formato Markdown + archivos detectados
            const pageResult = await this.course.getPageContent(pageId);
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
            const exercises: Exercise[] = response.exercises.map(
                (ex) => new Exercise(ex.name, ex.statement)
            );

            console.log(`[identifyExercises] Se identificaron ${exercises.length} ejercicios`);
            return exercises;

        } catch (error) {
            console.error(`[identifyExercises] Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Error al identificar ejercicios: ${error.message}`);
            }
            throw new Error('Error desconocido al identificar ejercicios');
        }
    }
}
