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
    private buildSystemPrompt(exercises?: any[]): string {
        const courseContext = JSON.stringify(this.course);

        let exerciseContext = '';
        if (exercises && exercises.length > 0) {
            exerciseContext = `\n\nEJERCICIOS DISPONIBLES EN ESTA PÁGINA:
El usuario está actualmente en una página con ${exercises.length} ejercicios. Cuando el usuario solicite la explicación de un ejercicio específico (por ejemplo: "explica el ejercicio 3", "¿cómo se resuelve el segundo ejercicio?", etc.), debes usar la herramienta explainExercise para abrir el modal de explicación del ejercicio correspondiente.

Lista de ejercicios disponibles:
${exercises.map((ex, idx) => `${ex.name}`).join('\n')}

Para identificar los ejercicios, usa los nombres listados arriba. El usuario podrá referirse a ellos por nombre, por número, de forma relativa ("el siguiente al que acabas de resolver"). Ten en cuenta que los ejercicios vienen en el orden que se muestran en la página.

Cuando el usuario pida ver/explicar un ejercicio, usa la herramienta explainExercise para abrir el modal de explicación.`;
        }

        return `Eres un asistente en una extensión de Chrome cuyo objetivo es ayudar a estudiantes con el contenido de sus cursos en Egela (plataforma educativa de la Universidad del País Vasco).

INSTRUCCIONES IMPORTANTES:
- Cuando el usuario mencione una sección por su título/nombre, busca su ID en la lista de sections anterior. El usuario no conoce los IDs, solo los títulos, así que NUNCA debes preguntarle el ID, sino buscarlo en la lista de secciones que se te proporciona al inicio. Si no sabes donde buscar, mira en todas las secciones hasta encontrar lo que buscas. Debes preguntarte "¿dónde es más probable que esté esta información?" y buscar en consecuencia. Nunca decirle al usuario que no sabes el ID o que no tienes acceso a esa información.
- Para obtener el contenido detallado de una sección, usa la herramienta getSectionContent con el ID de la sección
- Los IDs de las secciones son los valores del campo "id" (por ejemplo: "1378079")
- Si el usuario pide información sobre "la sección 2" o "tema 2", busca la sección con sectionNumber: 2 y usa su ID
- Responde de forma directa, útil y concisa
- Si necesitas información sobre una sección específica, llama a getSectionContent para obtenerla antes de responder
- Recuerda que NUNCA debes pedirle al usuario que te proporcione IDs, sino buscarlos tú mismo en la estructura del curso. El usuario no tiene esos IDs ni va a saber dártelos. La información que tienes es suficiente para encontrar los IDs necesarios.
${exerciseContext}

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones disponibles. Cada sección tiene un ID único que debes usar cuando necesites obtener su contenido detallado.

${courseContext}`;
    }

    /**
     * Genera una respuesta del asistente usando el curso actual
     * @param userMessage Mensaje del usuario
     * @param resetHistory Si es true, reinicia el historial de conversación
     * @param exercises Lista opcional de ejercicios disponibles en la página actual
     * @returns La respuesta final del asistente
     */
    async generateResponse(userMessage: string, resetHistory: boolean = false, exercises?: any[]): Promise<string> {
        if (resetHistory) {
            OpenAIService.resetConversation();
        }

        const systemPrompt = resetHistory ? this.buildSystemPrompt(exercises) : undefined;

        return await OpenAIService.processResponseWithTools(
            (name, args) => this.executeToolCall(name, args),
            userMessage,
            systemPrompt
        );
    }
}
