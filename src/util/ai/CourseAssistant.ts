import { BaseAssistant } from "./BaseAssistant";
import { OpenAIService } from "./OpenAIService";

export { CourseAssistant };

/**
 * Asistente para funcionalidad general del curso
 * Maneja conversaciones y herramientas relacionadas con el curso
 */
class CourseAssistant extends BaseAssistant {

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
- Cuando el usuario mencione una sección por su título/nombre, busca su ID en la lista de sections anterior. El usuario no conoce los IDs, solo los títulos, así que NUNCA debes preguntarle el ID, sino buscarlo en la lista de secciones que se te proporciona al inicio. Si no sabes donde buscar, mira en todas las secciones hasta encontrar lo que buscas. Debes preguntarte "¿dónde es más probable que esté esta información?" y buscar en consecuencia. Nunca decirle al usuario que no sabes el ID o que no tienes acceso a esa información.
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
        this.ensureCourseLoaded();

        if (name === 'getSectionContent') {
            return await this.course!.getSectionContent(args.sectionId);
        } 
        
        if (name === 'getResourceContent') {
            const fileData = await this.course!.getResourceFile(args.resourceId);
            
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
}
