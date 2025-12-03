import { Exercise } from "../egela/Exercise";
import { ExerciseStorageManager } from "../storage/ExerciseStorageManager";
import { LabStorageManager } from "../storage/LabStorageManager";
import { AssistantConfig } from "./AssistantConfig";
import { BaseAssistant } from "./BaseAssistant";
import { ExerciseListSchemaType } from "./schemas";

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
     * Obtiene los learningObjectives y concepts de los laboratorios requeridos anteriores al pageId especificado
     * @param pageId ID de la página actual
     * @param allLabs Lista de todos los laboratorios del curso
     * @returns String formateado con los objetivos y conceptos de laboratorios previos
     */
    private async getPreviousLabObjectives(pageId: string, allLabs: any[]): Promise<string> {
        // Filtrar solo laboratorios requeridos
        const requiredLabs = allLabs.filter(lab => lab.required);

        // Encontrar el índice del laboratorio actual
        const currentLabIndex = requiredLabs.findIndex(lab => lab.id === pageId);

        // Si no se encuentra el lab actual o es el primero, no hay laboratorios previos
        if (currentLabIndex <= 0) {
            return 'No hay laboratorios previos requeridos para este laboratorio.';
        }

        // Obtener solo los laboratorios anteriores al actual
        const previousLabs = requiredLabs.slice(0, currentLabIndex);

        // Recopilar información de cada laboratorio previo
        const labsInfo = await Promise.all(
            previousLabs.map(async (lab) => {
                const exerciseData = await ExerciseStorageManager.getExerciseData(lab.id);

                if (!exerciseData) {
                    return `\n### ${lab.name} (ID: ${lab.id})\n- Sin datos almacenados`;
                }

                const objectives = exerciseData.learningObjectives || 'No especificados';
                const concepts = exerciseData.concepts && exerciseData.concepts.length > 0
                    ? exerciseData.concepts.join(', ')
                    : 'No especificados';

                return `\n### ${lab.name} (ID: ${lab.id})\n**Objetivos de aprendizaje:** ${objectives}\n**Conceptos trabajados:** ${concepts}`;
            })
        );

        return labsInfo.join('\n');
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

            // 2. Construir el system prompt usando la configuración
            const assistantConfig = this.config.exerciseAssistant;
            const courseId = this.course?.id;
            const labData = courseId ? await LabStorageManager.getLabData(courseId) : null;
            const allLabs = labData?.labs ?? [];

            // 2.1. Obtener objetivos y conceptos de laboratorios previos
            const previousObjectives = await this.getPreviousLabObjectives(pageId, allLabs);
            console.log(`[identifyExercises] Objetivos previos obtenidos`);

            const systemPromptTemplate = `Eres un asistente experto en {role}.

Tu tarea es analizar el contenido de una página educativa, identificar los ejercicios y extraer información relevante.

El id de la página actual es ${pageId}.

HERRAMIENTAS DISPONIBLES:
1. getFilteredFileContent: Para extraer contenido específico de archivos de texto usando expresiones regulares.
   - Usa esta herramienta cuando veas marcadores como [FILE1:TEXT:nombre.sql]
   - Ejemplo para obtener CREATE TABLEs: usa el patrón "CREATE\\s+TABLE[\\s\\S]+?;"
   
2. postExercises: OBLIGATORIA - Debes usar esta herramienta exactamente una vez al final para enviar los ejercicios identificados.
   - Esta herramienta es tu forma de "responder" con los resultados del análisis
   - Debes llamarla siempre, incluso si no hay ejercicios (envía un array vacío)
   - Si recibes como respuesta "Ejercicios recibidos correctamente", significa que tu llamada fue exitosa y no debes que volver a llamarla. Simplemente termina la conversación diciendo "OK", ya que lo que digas después del post se va a ignorar.

FLUJO DE TRABAJO:
1. Analiza el contenido de la página
2. Si hay archivos de texto (marcadores [FILEn:TEXT:nombre]), usa getFilteredFileContent para extraer información relevante
3. Identifica todos los ejercicios en la página
4. OBLIGATORIO: Llama a postExercises con toda la información recopilada

CONTEXTO DE LABORATORIOS PREVIOS:
A continuación se muestran los objetivos de aprendizaje y conceptos trabajados en laboratorios anteriores REQUERIDOS.
Esta información te ayudará a entender qué conocimientos previos tienen los estudiantes para este laboratorio.
Considera estos conceptos como conocimiento adquirido, y enfócate en identificar qué NUEVOS conceptos se trabajan en los ejercicios actuales.

{previousObjectives}

CRITERIOS PARA IDENTIFICAR EJERCICIOS:
{exerciseCriteria}

CONTEXTO DE EJERCICIOS:
- {contextDescription}
- Si detectas tal información, inclúyela en el campo "exercise_context"
- Si no la detectas, envía ese campo vacío

CONCEPTOS:
- Analiza los ejercicios e identifica qué {conceptsFieldDescription}
- Sé específico cuando sea posible
- Ejemplos: {conceptsExamples}
- Si no hay ejercicios, este campo debe estar vacío

OBJETIVOS DE APRENDIZAJE:
- {learningObjectivesGuidance}

IMPORTANTE: Debes llamar a postExercises exactamente una vez al final del análisis.
`;

            const systemPromptVariables = {
                role: assistantConfig.role,
                exerciseCriteria: assistantConfig.exerciseCriteria,
                contextDescription: assistantConfig.contextDescription,
                conceptsFieldDescription: assistantConfig.conceptsFieldDescription,
                conceptsExamples: assistantConfig.conceptsExamples,
                learningObjectivesGuidance: assistantConfig.learningObjectivesGuidance,
                previousObjectives: previousObjectives
            };

            const systemPrompt = this.buildPromptFromTemplate(systemPromptTemplate, systemPromptVariables);

            const userPrompt = `Analiza el siguiente contenido de una página educativa e identifica los ejercicios.

Contenido de la página:

${pageContent}`;

            // Usar processResponseWithTools para permitir que el LLM use getFilteredFileContent
            // y al final llame a postExercises con los resultados
            this.openAIService.resetConversation();
            console.log(`[identifyExercises] Iniciando análisis con tools`);

            let exerciseResult: ExerciseListSchemaType | null = null;

            // El toolExecutor captura cuando se llama a postExercises
            const result = await this.openAIService.processResponseWithTools(
                async (name: string, args: any) => {
                    if (name === 'postExercises') {
                        // Capturar los ejercicios identificados
                        exerciseResult = args as ExerciseListSchemaType;
                        return 'Ejercicios recibidos correctamente';
                    }
                    // Ejecutar otras tools normalmente (getFilteredFileContent)
                    return this.executeToolCall(name, args);
                },
                userPrompt,
                systemPrompt
            );

            // Verificar que se recibió una respuesta válida
            if (!exerciseResult) {
                console.warn(`[identifyExercises] El LLM no llamó a postExercises. Retornando resultado vacío.`);
                return {
                    exercises: [],
                    exerciseContext: undefined,
                    concepts: [],
                    learningObjectives: undefined,
                };
            }

            const response: ExerciseListSchemaType = exerciseResult;
            console.log(`[identifyExercises] Respuesta recibida:`, response);

            // 3. Convertir a objetos Exercise
            const exercises: Exercise[] = response.exercises.map(
                (ex: { name: string; statement: string }) => new Exercise(ex.name, ex.statement)
            );

            console.log(`[identifyExercises] Se identificaron ${exercises.length} ejercicios, exercise_context presente: ${!!response.exercise_context}`);
            console.log(`[identifyExercises] Conceptos: ${response.concepts?.join(', ') || 'N/A'}`);
            console.log(`[identifyExercises] Objetivos de aprendizaje: ${response.learning_objectives || 'N/A'}`);

            // 4. Guardar los datos en el storage para uso futuro
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
