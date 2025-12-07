// List of models and their compatible parameters
export interface ModelConfig {
    name: string;
    supportsVerbosity?: boolean;
    supportsReasoning?: boolean;
}

export const MODEL_LIST: ModelConfig[] = [
    {
        name: "gpt-5-mini",
        supportsVerbosity: true,
        supportsReasoning: false
    },
    {
        name: "gpt-5",
        supportsVerbosity: true,
        supportsReasoning: true
    },
    {
        name: "gpt-5.1",
        supportsVerbosity: false,
        supportsReasoning: false
    }
];

/**
 * Gets model configuration by name
 * @param modelName Model name
 * @returns Model configuration or undefined if not in the list
 */
export function getModelConfig(modelName: string): ModelConfig | undefined {
    return MODEL_LIST.find(m => modelName == m.name);
}

/**
 * Checks if a model supports the verbosity parameter
 * @param modelName Model name
 * @returns true if it supports verbosity, false otherwise
 */
export function supportsVerbosity(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsVerbosity ?? false;
}

/**
 * Checks if a model supports the reasoning parameter
 * @param modelName Model name
 * @returns true if it supports reasoning, false otherwise
 */
export function supportsReasoning(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsReasoning ?? false;
}

/**
 * Generates a system instruction to simulate verbosity when the model does not support it natively
 * @param verbosity Desired verbosity level
 * @returns Instruction to add to the system prompt
 */
export function getVerbosityInstruction(verbosity: "low" | "medium" | "high"): string {
    switch (verbosity) {
        case "low":
            return "VERBOSITY INSTRUCTION: Be concise and direct. Use the minimum words necessary to convey essential information. Avoid long or redundant explanations.";
        case "medium":
            return "VERBOSITY INSTRUCTION: Provide a balanced level of detail. Explain important concepts without being overly verbose.";
        case "high":
            return "VERBOSITY INSTRUCTION: Be very detailed and exhaustive in your explanations. Include additional context, examples, and elaborations that help full understanding.";
    }
}

/**
 * Generates a system instruction to simulate reasoning effort when the model does not support it natively
 * @param effort Desired reasoning effort level
 * @returns Instruction to add to the system prompt
 */
export function getReasoningInstruction(effort: "minimal" | "low" | "medium" | "high"): string {
    switch (effort) {
        case "minimal":
            return "REASONING INSTRUCTION: Respond directly without showing reasoning process. Give the answer immediately.";
        case "low":
            return "REASONING INSTRUCTION: Show only essential reasoning. A brief analysis before the answer.";
        case "medium":
            return "REASONING INSTRUCTION: Include a moderate reasoning process. Show the main steps of your analysis.";
        case "high":
            return "REASONING INSTRUCTION: Show your entire reasoning process step by step. Explain each consideration and decision before reaching the final answer.";
    }
}
