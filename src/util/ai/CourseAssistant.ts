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

        return await OpenAIService.processWithTools(
            (name, args) => this.executeToolCall(name, args),
            userMessage,
            systemPrompt
        );
    }
}
