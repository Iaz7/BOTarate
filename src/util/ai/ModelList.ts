// Lista de modelos y sus parámetros compatibles
export interface ModelConfig {
    name: string;
    supportsVerbosity?: boolean;
    supportsReasoning?: boolean;
}

export const MODEL_LIST: ModelConfig[] = [
    {
        name: "gpt-5",
        supportsVerbosity: true,
        supportsReasoning: true
    },
    {
        name: "gpt-5.1",
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "gpt-5-mini",
        supportsVerbosity: true,
        supportsReasoning: true
    },
    {
        name: "gpt-4",
        supportsVerbosity: false,
        supportsReasoning: false
    },
    {
        name: "gpt-3.5-turbo",
        supportsVerbosity: false,
        supportsReasoning: false
    }
];

/**
 * Obtiene la configuración de un modelo por su nombre
 * @param modelName Nombre del modelo
 * @returns Configuración del modelo o undefined si no está en la lista
 */
export function getModelConfig(modelName: string): ModelConfig | undefined {
    return MODEL_LIST.find(m => modelName == m.name);
}

/**
 * Verifica si un modelo soporta el parámetro de verbosidad
 * @param modelName Nombre del modelo
 * @returns true si soporta verbosity, false en caso contrario
 */
export function supportsVerbosity(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsVerbosity ?? false;
}

/**
 * Verifica si un modelo soporta el parámetro de razonamiento
 * @param modelName Nombre del modelo
 * @returns true si soporta reasoning, false en caso contrario
 */
export function supportsReasoning(modelName: string): boolean {
    const config = getModelConfig(modelName);
    return config?.supportsReasoning ?? false;
}

/**
 * Genera una instrucción de sistema para simular verbosidad cuando el modelo no la soporta nativamente
 * @param verbosity Nivel de verbosidad deseado
 * @returns Instrucción para añadir al system prompt
 */
export function getVerbosityInstruction(verbosity: "low" | "medium" | "high"): string {
    switch (verbosity) {
        case "low":
            return "INSTRUCCIÓN DE VERBOSIDAD: Sé conciso y directo. Utiliza el mínimo de palabras necesarias para transmitir la información esencial. Evita explicaciones largas o redundantes.";
        case "medium":
            return "INSTRUCCIÓN DE VERBOSIDAD: Proporciona un nivel de detalle equilibrado. Explica los conceptos importantes sin ser excesivamente verboso.";
        case "high":
            return "INSTRUCCIÓN DE VERBOSIDAD: Sé muy detallado y exhaustivo en tus explicaciones. Incluye contexto adicional, ejemplos y elaboraciones que ayuden a la comprensión completa.";
    }
}

/**
 * Genera una instrucción de sistema para simular esfuerzo de razonamiento cuando el modelo no lo soporta nativamente
 * @param effort Nivel de esfuerzo de razonamiento deseado
 * @returns Instrucción para añadir al system prompt
 */
export function getReasoningInstruction(effort: "minimal" | "low" | "medium" | "high"): string {
    switch (effort) {
        case "minimal":
            return "INSTRUCCIÓN DE RAZONAMIENTO: Responde de forma directa sin mostrar proceso de razonamiento. Da la respuesta inmediatamente.";
        case "low":
            return "INSTRUCCIÓN DE RAZONAMIENTO: Muestra solo el razonamiento esencial. Un breve análisis antes de la respuesta.";
        case "medium":
            return "INSTRUCCIÓN DE RAZONAMIENTO: Incluye un proceso de razonamiento moderado. Muestra los pasos principales de tu análisis.";
        case "high":
            return "INSTRUCCIÓN DE RAZONAMIENTO: Muestra todo tu proceso de razonamiento paso a paso. Explica cada consideración y decisión antes de llegar a la respuesta final.";
    }
}
