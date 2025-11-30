import { Exercise } from "../egela/Exercise";
import { ExerciseStorageManager } from "../storage/ExerciseStorageManager";
import { LabStorageManager } from "../storage/LabStorageManager";
import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import { ExerciseListSchema } from "./schemas";

export { ExerciseAssistant };

/**
 * Asistente para análisis de ejercicios
 * Maneja la identificación y análisis de ejercicios en páginas del curso
 */
class ExerciseAssistant extends BaseAssistant {

    constructor(config: AssistantConfig) {
        super(config);
    }

    /**
     * Identifica los ejercicios en una página usando el LLM con respuestas estructuradas
     * @param pageId ID de la página de Egela
     * @param resourceId ID del recurso (para ubicarlo en la lista de recursos de la sección)
     * @returns Array de ejercicios identificados (vacío si no hay ejercicios), contexto de ejercicios y conceptos pedagógicos
     */
    async identifyExercises(pageId: string, resourceId?: string): Promise<{
        exercises: Exercise[];
        exerciseContext?: string;
        concepts?: string[];
        learningObjectives?: string;
    }> {
        console.log(`[identifyExercises] Identificando ejercicios en página: ${pageId}. Course ID: ${this.course?.id}`);

        try {
            // 1. Obtener el contenido de la página en formato Markdown + archivos detectados
            const pageResult = await this.course!.getPageContent(pageId);
            const pageContent = pageResult.markdown;
            const attachedFiles = pageResult.files;
            console.log(`[identifyExercises] Contenido de la página obtenido (${pageContent.length} caracteres), archivos: ${attachedFiles.length}`);

            // 2. Obtener contexto del curso
            const courseContext = JSON.stringify(this.course);

            // 3. Construir el system prompt usando la configuración
            const assistantConfig = this.config.exerciseAssistant;
            const courseId = this.course?.id;
            const labData = courseId ? await LabStorageManager.getLabData(courseId) : null;
            const allLabs = labData?.labs ?? [];
            const requiredLabs = allLabs.filter(lab => lab.required);

            const labConfigurationDescription = allLabs.length > 0
                ? allLabs
                    .map(lab => `- ${lab.name} (ID: ${lab.id}) | requerido: ${lab.required ? 'sí' : 'no'}`)
                    .join('\n')
                : 'No hay laboratorios configurados para este curso.';

            const requiredLabsGuidance = requiredLabs.length > 0
                ? `Solo consulta los laboratorios marcados como REQUERIDOS cuando necesites teoría previa. Lista:
${requiredLabs.map(lab => `  * ${lab.name} (ID: ${lab.id})`).join('\n')}
Limita cualquier búsqueda de recursos adicionales a estos laboratorios y a los recursos inmediatamente anteriores dentro de cada uno.`
                : 'Actualmente no hay laboratorios marcados como requeridos. No revises laboratorios previos automáticamente; utiliza únicamente el recurso actual u otros recursos explícitamente solicitados.';

            const resourceInstructions = resourceId ? `
UBICACIÓN DE LOS EJERCICIOS:
- Los ejercicios que estás analizando están en el recurso con ID: ${resourceId}
- Los recursos (diapositivas, ejercicios, etc.) aparecen en ORDEN dentro de las secciones del curso
- Las diapositivas de teoría relacionadas con estos ejercicios CASI SIEMPRE están inmediatamente ANTES de este recurso en la lista
- Busca en la estructura del curso el recurso ${resourceId} para ver qué recursos vienen antes
- Los recursos anteriores (especialmente PDFs de diapositivas) contienen la teoría que debes revisar

${assistantConfig.additionalPhase1Instructions || ''}
` : '';

            const systemPromptTemplate = `Eres un asistente experto en {role}.

FLUJO DE TRABAJO EN 2 FASES:
Este proceso se realizará en dos fases dentro de la misma conversación:
- FASE 1: Recopilación de información usando herramientas (getSectionContent, getResourceContent)
- FASE 2: Generación de respuesta estructurada con toda la información recopilada

La información obtenida en la FASE 1 se mantiene en el historial y estará disponible para la FASE 2.

ACCESO A RECURSOS DEL CURSO:
Tienes acceso a las herramientas getSectionContent, getPageContent y getResourceContent para consultar material del curso.
{resourceInstructions}

CONFIGURACIÓN DE LABORATORIOS:
{labConfigurationDescription}

REGLAS PARA CONSULTAR LABORATORIOS:
{requiredLabsGuidance}

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones y recursos. Cada sección y recurso tiene un ID único.

{courseContext}

ADVERTENCIA SOBRE ARCHIVOS:
- En el markdown que recibirás pueden aparecer marcas como [FILE1], [FILE2], etc. Esos marcadores representan archivos adjuntos que corresponden a la posición en la página donde estaba el archivo (imagen, SQL, PDF, etc.).
- Cuando encuentres un marcador [FILEn], consulta el archivo adjunto con ese índice. Si es una imagen que contiene una tabla, conviértela a formato Markdown si es posible. Si es un fichero de texto (SQL, MD, TXT), utiliza su contenido para completar el enunciado.

CRITERIOS PARA IDENTIFICAR EJERCICIOS (FASE 2):
{exerciseCriteria}

CONTEXTO DE EJERCICIOS (FASE 2):
- {contextDescription}
- Si detectas tal información, devuélvela en el campo "{contextFieldName}"
- Si no la detectas, devuelve ese campo vacío

CONCEPTOS (FASE 2):
- Analiza los ejercicios e identifica qué {conceptsFieldDescription}
- Usa la información de las diapositivas previas que consultaste en la FASE 1
- Devuelve estos conceptos en el campo "{conceptsFieldName}" como un array de strings
- Sé específico cuando sea posible
- Ejemplos: {conceptsExamples}
- Si no hay ejercicios, este campo debe estar vacío

OBJETIVOS DE APRENDIZAJE (FASE 2):
- {learningObjectivesGuidance}
`;

            const systemPromptVariables = {
                role: assistantConfig.role,
                resourceInstructions: resourceInstructions,
                courseContext: courseContext,
                exerciseCriteria: assistantConfig.exerciseCriteria,
                contextDescription: assistantConfig.contextDescription,
                contextFieldName: assistantConfig.contextFieldName,
                conceptsFieldDescription: assistantConfig.conceptsFieldDescription,
                conceptsFieldName: assistantConfig.conceptsFieldName,
                conceptsExamples: assistantConfig.conceptsExamples,
                learningObjectivesGuidance: assistantConfig.learningObjectivesGuidance,
                labConfigurationDescription: labConfigurationDescription,
                requiredLabsGuidance: requiredLabsGuidance
            };

            const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

            const userPromptPhase1 = `FASE 1: RECOPILACIÓN DE INFORMACIÓN

Analiza el siguiente contenido de una página educativa. Por favor, recopila toda la información necesaria consultando los recursos del curso que consideres relevantes.
Contenido de la página:

${pageContent}`;

            // 4. FASE 1: Generar respuesta con tools (permitir al LLM consultar recursos)
            // NO resetear la conversación para mantener el historial entre fases
            this.openAIService.resetConversation();
            console.log(`[identifyExercises] FASE 1: Iniciando recopilación de información con tools`);

            // Permitir que el LLM use tools para consultar recursos adicionales
            // Los archivos adjuntos se pasan aquí para que el LLM pueda ver el contenido de la página
            await this.openAIService.processResponseWithTools(
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
2. El esquema de base de datos si existe. Esquema se refiere al script de creación de tablas y relaciones entre ellas, de modo que sirva para entender cómo se estructura la base de datos.
3. Las instrucciones SQL que se trabajan en los ejercicios
4. Los objetivos de aprendizaje de la página`;

            console.log(`[identifyExercises] FASE 2: Generando respuesta estructurada`);

            // NO pasar systemPrompt aquí porque ya está en el historial
            const response: any = await this.openAIService.generateStructuredResponse(
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

            console.log(`[identifyExercises] Se identificaron ${exercises.length} ejercicios, exercise_context presente: ${!!response.exercise_context}`);
            console.log(`[identifyExercises] Conceptos: ${response.concepts?.join(', ') || 'N/A'}`);
            console.log(`[identifyExercises] Objetivos de aprendizaje: ${response.learning_objectives || 'N/A'}`);

            // 6. Guardar los datos en el storage para uso futuro
            const existingExerciseData = await ExerciseStorageManager.getExerciseData(pageId);
            const exerciseDataToStore = exercises.map(ex => {
                const previous = existingExerciseData?.exercises.find(prev => prev.name === ex.name);
                return {
                    name: ex.name,
                    statement: ex.statement,
                    allowed: previous?.allowed ?? ex.allowed,
                    isTiquismiqui: previous?.isTiquismiqui ?? ex.isTiquismiqui,
                };
            });
            await ExerciseStorageManager.saveExerciseData(
                pageId,
                exerciseDataToStore,
                response.exercise_context || '',
                response.concepts || [],
                response.learning_objectives || ''
            );
            console.log(`[identifyExercises] Datos guardados en storage para página ${pageId}`);

            return {
                exercises,
                exerciseContext: response.exercise_context || undefined,
                concepts: response.concepts || [],
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
