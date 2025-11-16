import { AssistantConfig } from "../util/ai/AssistantConfig";
import { CourseAssistant } from "../util/ai/CourseAssistant";
import { EvaluationAssistant } from "../util/ai/EvaluationAssistant";
import { ExerciseAssistant } from "../util/ai/ExerciseAssistant";
import { ExplanationAssistant } from "../util/ai/ExplanationAssistant";
import { AssistantConfigStorageManager } from "../util/storage/AssistantConfigStorageManager";

let isConfigLoaded = false;
let assistantsConfig: AssistantConfig;
let courseAssistant: CourseAssistant;
let exerciseAssistant: ExerciseAssistant;
let explanationAssistant: ExplanationAssistant;
let evaluationAssistant: EvaluationAssistant;

export async function initializeAssistants(): Promise<void> {
    assistantsConfig = await AssistantConfigStorageManager.loadConfig();

    courseAssistant = new CourseAssistant(assistantsConfig);
    exerciseAssistant = new ExerciseAssistant(assistantsConfig);
    explanationAssistant = new ExplanationAssistant(assistantsConfig);
    evaluationAssistant = new EvaluationAssistant(assistantsConfig);

    console.log("Asistentes inicializados con configuración cargada");
}

export function getCourseAssistant(): CourseAssistant {
    if (!courseAssistant) {
        throw new Error("El asistente de cursos no ha sido inicializado");
    }
    return courseAssistant;
}

export function getExerciseAssistant(): ExerciseAssistant {
    if (!exerciseAssistant) {
        throw new Error("El asistente de ejercicios no ha sido inicializado");
    }
    return exerciseAssistant;
}

export function getExplanationAssistant(): ExplanationAssistant {
    if (!explanationAssistant) {
        throw new Error("El asistente de explicaciones no ha sido inicializado");
    }
    return explanationAssistant;
}

export function getEvaluationAssistant(): EvaluationAssistant {
    if (!evaluationAssistant) {
        throw new Error("El asistente de evaluaciones no ha sido inicializado");
    }
    return evaluationAssistant;
}

export function markConfigLoaded(): void {
    isConfigLoaded = true;
}

export function resetConfigLoaded(): void {
    isConfigLoaded = false;
}

export function isConfigReady(): boolean {
    return isConfigLoaded;
}
