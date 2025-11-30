import { EvaluationStorageManager } from "../../util/storage/EvaluationStorageManager";
import { ExerciseStorageManager } from "../../util/storage/ExerciseStorageManager";
import { ExplanationStorageManager } from "../../util/storage/ExplanationStorageManager";
import { Lab, LabStorageManager } from "../../util/storage/LabStorageManager";
import { getCourseAssistant, getEvaluationAssistant, getExplanationAssistant } from "../context";

async function buildProgressSummary(courseId?: string): Promise<string | undefined> {
    if (!courseId) {
        return undefined;
    }

    const requiredLabs = await getRequiredLabs(courseId);
    if (!requiredLabs || requiredLabs.length === 0) {
        return undefined;
    }

    const { completedLabs, completedExercises } = await collectLabCompletionData(requiredLabs);
    if (completedLabs.length === 0 && completedExercises.size === 0) {
        return "El alumno aún no ha completado ningún laboratorio ni ejercicio.\n";
    }

    return formatProgressSummary(completedLabs, completedExercises);
}

async function getRequiredLabs(courseId: string): Promise<Lab[] | undefined> {
    const labData = await LabStorageManager.getLabData(courseId);
    return labData?.labs?.filter(lab => lab.required);
}

async function collectLabCompletionData(labs: Lab[]): Promise<{ completedLabs: string[]; completedExercises: Map<string, string[]>; }> {
    const completedLabs: string[] = [];
    const completedExercises: Map<string, string[]> = new Map();

    for (const lab of labs) {
        const result = await analyzeLabCompletion(lab);
        if (!result) {
            continue;
        }

        if (result.allCompleted) {
            completedLabs.push(lab.name);
        }

        if (result.completedExercises.length > 0) {
            completedExercises.set(lab.name, result.completedExercises);
        }
    }

    return { completedLabs, completedExercises };
}

async function analyzeLabCompletion(lab: Lab): Promise<{ allCompleted: boolean; completedExercises: string[] } | undefined> {
    const exerciseData = await ExerciseStorageManager.getExerciseData(lab.id);
    if (!exerciseData) {
        return undefined;
    }

    const challengeExercises = exerciseData.exercises.filter((ex: any) => ex.allowed === false);
    if (challengeExercises.length === 0) {
        return undefined;
    }

    let allCompleted = true;
    const completedInLab: string[] = [];

    for (const exercise of challengeExercises) {
        const evaluations = await EvaluationStorageManager.getEvaluations(lab.id, exercise.name);
        if (!evaluations || evaluations.length === 0) {
            allCompleted = false;
            continue;
        }

        const bestScore = Math.max(...evaluations.map((e: any) => e.score));
        if (bestScore >= 5) {
            completedInLab.push(exercise.name);
        } else {
            allCompleted = false;
        }
    }

    return { allCompleted, completedExercises: completedInLab };
}

function formatProgressSummary(completedLabs: string[], completedExercises: Map<string, string[]>): string {
    let summary = "";

    if (completedLabs.length > 0) {
        summary += `- Laboratorios completados: ${completedLabs.join(', ')}\n`;
    }

    if (completedExercises.size > 0) {
        summary += "- Ejercicios completados por laboratorio:\n";
        for (const [labName, exercises] of completedExercises) {
            summary += `  * ${labName}: ${exercises.join(', ')}\n`;
        }
    }

    return summary;
}

export function handleGenerateResponse(request: any, sendResponse: (response?: any) => void): boolean {
    const { userMessage, resetHistory, exercises } = request;
    const courseAssistant = getCourseAssistant();

    console.log("Generando respuesta LLM en background...");

    courseAssistant.generateResponse(userMessage, resetHistory, exercises)
        .then(finalResponse => sendResponse(finalResponse))
        .catch(error => {
            console.error('Error en generateResponse:', error);
            sendResponse(`Error: ${error.message}`);
        });

    return true;
}

export function handleGenerateExplanation(request: any, sendResponse: (response?: any) => void): boolean {
    const { exerciseName, pageId, courseId } = request;
    const explanationAssistant = getExplanationAssistant();

    console.log(`Generando explicación para ejercicio: ${exerciseName}`);

    (async () => {
        try {
            const exerciseData = await ExerciseStorageManager.getExerciseData(pageId);
            if (exerciseData) {
                const exercise = exerciseData.exercises.find(ex => ex.name === exerciseName);
                if (exercise?.allowed === false) {
                    console.log(`Intento de explicar ejercicio bloqueado: ${exerciseName}`);
                    sendResponse({
                        success: false,
                        error: `El ejercicio "${exerciseName}" está bloqueado y no puede ser explicado.`
                    });
                    return;
                }
                const progressSummary = await buildProgressSummary(courseId);

                const explanation = await explanationAssistant.generateExplanation(
                    exerciseName,
                    exercise?.statement || '',
                    exerciseData?.exerciseContext,
                    exerciseData?.concepts,
                    exerciseData?.learningObjectives,
                    progressSummary
                );

                console.log(`Explicación generada:`, explanation);

                await ExplanationStorageManager.saveExplanation(
                    pageId,
                    exerciseName,
                    exercise?.statement || '',
                    explanation,
                    exerciseData.exerciseContext
                );
                console.log(`Explicación guardada en cache para: ${exerciseName}`);

                sendResponse({ success: true, explanation: explanation });
            }
            else {
                sendResponse({
                    success: false,
                    error: `No se ha podido cargar el ejercicio "${exerciseName}".`
                });
            }
        } catch (error: any) {
            console.error('Error en generateExplanation:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleEvaluateSolution(request: any, sendResponse: (response?: any) => void): boolean {
    const { exerciseName, exerciseStatement, studentSolution, exercise_context, concepts, learning_objectives, pageId } = request;
    const evaluationAssistant = getEvaluationAssistant();

    console.log(`Evaluando solución para ejercicio: ${exerciseName}`);

    (async () => {
        try {
            const evaluation = await evaluationAssistant.evaluateSolution(
                exerciseName,
                exerciseStatement,
                studentSolution,
                exercise_context,
                concepts,
                learning_objectives
            );

            console.log(`Solución evaluada con puntuación: ${evaluation.score}/10`);

            if (pageId) {
                await EvaluationStorageManager.saveEvaluation(
                    pageId,
                    exerciseName,
                    studentSolution,
                    evaluation
                );
                console.log(`Evaluación guardada en storage para: ${exerciseName}`);
            }

            sendResponse({ success: true, evaluation: evaluation });
        } catch (error: any) {
            console.error('Error en evaluateSolution:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleLoadChatHistory(sendResponse: (response?: any) => void): boolean {
    const courseAssistant = getCourseAssistant();
    console.log('Cargando historial de chat...');

    (async () => {
        try {
            const messages = await courseAssistant.loadChatHistory();
            sendResponse({ success: true, messages });
        } catch (error: any) {
            console.error('Error al cargar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleResetChatHistory(sendResponse: (response?: any) => void): boolean {
    const courseAssistant = getCourseAssistant();
    console.log('Reiniciando historial de chat...');

    (async () => {
        try {
            await courseAssistant.resetChatHistory();
            sendResponse({ success: true });
        } catch (error: any) {
            console.error('Error al reiniciar historial de chat:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleInitializeExplanationChat(request: any, sendResponse: (response?: any) => void): boolean {
    const { pageId, exerciseName, courseId, fromCache } = request;
    const explanationAssistant = getExplanationAssistant();

    console.log(`Inicializando chat de explicación para: ${exerciseName} (fromCache: ${fromCache})`);

    (async () => {
        try {
            if (fromCache) {
                const explanation = await ExplanationStorageManager.getExplanation(pageId, exerciseName);

                if (!explanation) {
                    sendResponse({ success: false, error: 'No se encontró la explicación en el storage' });
                    return;
                }

                const exerciseData = await ExerciseStorageManager.getExerciseData(pageId);
                let concepts: string[] | undefined = undefined;
                let learningObjectives: string | undefined = undefined;

                if (exerciseData) {
                    concepts = exerciseData.concepts;
                    learningObjectives = exerciseData.learningObjectives;
                }

                const progressSummary = await buildProgressSummary(courseId);

                // Convertir el chatHistory al formato correcto para el asistente
                const chatHistoryForAssistant = explanation.chatHistory?.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                await explanationAssistant.initializeContextForFollowUp(
                    explanation.exerciseName,
                    explanation.exerciseStatement,
                    { steps: explanation.steps },
                    explanation.exerciseContext,
                    concepts,
                    learningObjectives,
                    progressSummary,
                    chatHistoryForAssistant
                );

                console.log(`Contexto de chat inicializado desde storage para: ${exerciseName}`);
                sendResponse({ success: true });
            } else {
                console.log(`Contexto de chat ya inicializado para explicación recién generada: ${exerciseName}`);
                sendResponse({ success: true });
            }
        } catch (error: any) {
            console.error('Error al inicializar chat de explicación:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

export function handleSendExplanationChatMessage(request: any, sendResponse: (response?: any) => void): boolean {
    const { message } = request;
    const explanationAssistant = getExplanationAssistant();

    console.log(`Procesando mensaje de chat de explicación: ${message}`);

    (async () => {
        try {
            const response = await explanationAssistant.continueConversation(message);
            sendResponse({ success: true, response });
        } catch (error: any) {
            console.error('Error al procesar mensaje de chat de explicación:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}
