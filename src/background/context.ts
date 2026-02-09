import { AgentConfig } from "../util/ai/AgentConfig";
import { CourseAgent } from "../util/ai/CourseAgent";
import { EvaluationAgent } from "../util/ai/EvaluationAgent";
import { ExerciseAgent } from "../util/ai/ExerciseAgent";
import { ExplanationAgent } from "../util/ai/ExplanationAgent";
import { AgentConfigStorageManager } from "../util/storage/AgentConfigStorageManager";
import { getCachedCourse } from "./handlers/dataHandlers";

let isConfigLoaded = false;
let agentsConfig: AgentConfig;
let courseAgent: CourseAgent;
let exerciseAgent: ExerciseAgent;
let explanationAgent: ExplanationAgent;
let evaluationAgent: EvaluationAgent;

export async function initializeAgents(): Promise<void> {
    agentsConfig = await AgentConfigStorageManager.loadConfig();

    courseAgent = new CourseAgent(agentsConfig);
    exerciseAgent = new ExerciseAgent(agentsConfig);
    explanationAgent = new ExplanationAgent(agentsConfig);
    evaluationAgent = new EvaluationAgent(agentsConfig);

    console.log("Agentes inicializados con configuración cargada");
}

export function getCourseAgent(): CourseAgent {
    if (!courseAgent) {
        throw new Error("El agente de cursos no ha sido inicializado");
    }
    return courseAgent;
}

export function getExerciseAgent(): ExerciseAgent {
    if (!exerciseAgent) {
        throw new Error("El agente de ejercicios no ha sido inicializado");
    }
    return exerciseAgent;
}

export function getExplanationAgent(): ExplanationAgent {
    if (!explanationAgent) {
        throw new Error("El agente de explicaciones no ha sido inicializado");
    }
    return explanationAgent;
}

export function getEvaluationAgent(): EvaluationAgent {
    if (!evaluationAgent) {
        throw new Error("El agente de evaluaciones no ha sido inicializado");
    }
    return evaluationAgent;
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

/**
 * Creates a new ExerciseAgent instance for parallel context generation
 * Each instance has its own OpenAIService to allow parallel API calls
 */
export function createExerciseAgent(): ExerciseAgent {
    if (!agentsConfig) {
        throw new Error("Agent config not loaded");
    }
    const agent = new ExerciseAgent(agentsConfig);
    let cachedCourse = getCachedCourse();
    if (cachedCourse) {
        agent.setCourse(cachedCourse);
    }
    return agent;
}

export function getAgentsConfig(): AgentConfig {
    if (!agentsConfig) {
        throw new Error("Agent config not loaded");
    }
    return agentsConfig;
}
