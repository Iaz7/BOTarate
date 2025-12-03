/**
 * Configuración para un asistente específico
 * Define las variables que se sustituirán en las plantillas de prompt
 */
export interface AssistantConfig {
    /**
     * Variables para el asistente de curso (chat general)
     */
    courseAssistant: {
        role: string;
        instructions: string;
        toolsDescription: string;
        additionalRules?: string;
    };

    /**
     * Variables para el asistente de identificación de ejercicios
     */
    exerciseAssistant: {
        role: string;
        contextDescription: string;
        conceptsFieldDescription: string;
        conceptsExamples: string;
        exerciseCriteria: string;
        learningObjectivesGuidance: string;

    };

    /**
     * Variables para el asistente de evaluación
     */
    evaluationAssistant: {
        role: string;
        taskDescription: string;
        evaluationCriteria: string;
        scoringScale: string;
        feedbackFormat: string;
        importantNotes?: string;
    };

    /**
     * Variables para el asistente de explicación/tutorial
     */
    explanationAssistant: {
        role: string;
        taskDescription: string;
        methodology: string;
        outputFormat: string;
        additionalRules?: string;
        importantNotes?: string;
    };

    /**
     * Configuración común para todos los asistentes
     */
    common: {
        subjectName: string;
        platformName: string;
        institutionName: string;
    };
}
