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
            // Crear lista manteniendo el orden original e indicando estado y un índice explícito
            // Mostramos tanto el número de posición (1..N) como un índice entre corchetes junto al nombre
            const exerciseList = exercises.map((ex, index) => {
                const pos = index + 1;
                const status = ex.allowed === false ? '[BLOQUEADO]' : '[PERMITIDO]';
                // Formato: "1. [ÍNDICE:1] Nombre del ejercicio [PERMITIDO]"
                return `${pos}. [ÍNDICE:${pos}] ${ex.name} ${status}`;
            }).join('\n');

            const blockedCount = exercises.filter(ex => ex.allowed === false).length;
            const allowedCount = exercises.length - blockedCount;

            exerciseContext = `\n\nEJERCICIOS DISPONIBLES EN ESTA PÁGINA:
El usuario está actualmente en una página con ${exercises.length} ejercicios (${allowedCount} permitidos, ${blockedCount} bloqueados). Cuando el usuario solicite la explicación de un ejercicio específico (por ejemplo: "explica el ejercicio 3", "¿cómo se resuelve el segundo ejercicio?", etc.), debes verificar primero si está bloqueado.

Lista de ejercicios en orden (cada línea muestra: posición. [ÍNDICE:pos] Nombre DEL EJERCICIO [ESTADO]):
${exerciseList}

IMPORTANTE SOBRE EJERCICIOS BLOQUEADOS:
- Los ejercicios marcados como [BLOQUEADO] NO pueden ser explicados.
- Si el usuario solicita la explicación de un ejercicio bloqueado, debes informarle que la resolución de ese ejercicio está bloqueada por el profesor para que lo resuelva por su cuenta.
- Menciona también qué otros ejercicios están bloqueados (si los hay).
- NO uses la herramienta explainExercise para ejercicios bloqueados.
- Los ejercicios bloqueados SÍ pueden ser resueltos por el estudiante usando la herramienta solveExercise.

IMPORTANTE SOBRE REFERENCIAS A EJERCICIOS:
- El usuario podrá referirse a los ejercicios por su número de posición (ejercicio 1, ejercicio 2, etc.), por nombre, o de forma relativa ("el siguiente", "el anterior").
- El número de posición (1..${exercises.length}) corresponde al orden listado arriba.
- Además, justo al lado del nombre incluimos la etiqueta [ÍNDICE:pos] — ESTE ES EL VALOR QUE DEBES PROPORCIONAR cuando el usuario te pida el índice de un ejercicio. Por ejemplo, si la línea es "2. [ÍNDICE:2] Ejercicio X [PERMITIDO]", y el usuario pide "dame el índice del ejercicio X", debes responder "2".
- Mantén siempre presente el orden de la lista para identificar correctamente los ejercicios.

Cuando el usuario pida ver/explicar un ejercicio PERMITIDO, usa la herramienta explainExercise para abrir el modal de explicación.
Cuando el usuario quiera resolver/intentar/enviar su solución para un ejercicio (PERMITIDO o BLOQUEADO), usa la herramienta solveExercise para abrir el formulario de resolución.`;
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
