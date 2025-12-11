/**
 * Configuration for a specific assistant
 * Defines variables to be substituted in prompt templates
 */
export interface AssistantConfig {

    /**
     * Variables for exercise identification assistant
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
     * Variables for evaluation assistant
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
     * Variables for explanation/tutorial assistant
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
     * Common configuration for all assistants
     */
    common: {
        subjectName: string;
        platformName: string;
        institutionName: string;
    };
}
