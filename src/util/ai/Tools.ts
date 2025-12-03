export { EXERCISE_ASSISTANT_TOOLS, TOOLS };
export type { ToolCall, ToolName, ToolResult };

/**
 * Nombres de las herramientas disponibles para el LLM
 */
type ToolName = 'getSectionContent' | 'getPageContent' | 'getResourceContent' | 'explainExercise' | 'solveExercise' | 'getFilteredFileContent' | 'postExercises';

/**
 * Estructura de una llamada a herramienta del LLM
 */
interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: ToolName;
        arguments: string; // JSON string
    };
}

/**
 * Resultado de la ejecución de una herramienta
 */
interface ToolResult {
    tool_call_id: string;
    role: 'tool';
    name: ToolName;
    content: string;
}

/**
 * Definiciones de las herramientas (tools) disponibles para el LLM
 * Formato compatible con OpenAI API
 */
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'getSectionContent',
            description: 'Obtiene el contenido textual de una sección del curso de Egela. Devuelve el resumen de la sección y la lista de recursos con sus IDs para que puedas referenciarlos.',
            parameters: {
                type: 'object',
                properties: {
                    sectionId: {
                        type: 'string',
                        description: 'El ID de la sección del curso (por ejemplo: "1378079")'
                    }
                },
                required: ['sectionId'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getPageContent',
            description: 'Obtiene el contenido textual de una página del curso de Egela. Devuelve el contenido completo de la página en formato texto.',
            parameters: {
                type: 'object',
                properties: {
                    pageId: {
                        type: 'string',
                        description: 'El ID de la página del curso (por ejemplo: "8986640")'
                    }
                },
                required: ['pageId'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getResourceContent',
            description: 'Obtiene el contenido de un recurso descargable del curso (PDF, imagen, documento HTML, page, etc.). El archivo se procesará según su formato: PDFs e imágenes se envían directamente a la API para análisis, otros formatos devuelven solo metadatos.',
            parameters: {
                type: 'object',
                properties: {
                    resourceId: {
                        type: 'string',
                        description: 'El ID del recurso (por ejemplo: "8986639"). Puedes encontrar los IDs en la lista de recursos de cada sección.'
                    }
                },
                required: ['resourceId'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'explainExercise',
            description: 'Inicia la generación de una explicación paso a paso para un ejercicio específico. Esta herramienta abrirá el modal de explicación del ejercicio en la interfaz de usuario. Usa esta herramienta cuando el usuario solicite explícitamente ver la explicación o resolución de un ejercicio.',
            parameters: {
                type: 'object',
                properties: {
                    exerciseIndex: {
                        type: 'number',
                        description: 'El índice del ejercicio en la lista de ejercicios disponibles. No es 0-based, sino directamente el que aparece al lado del ejercicio.'
                    }
                },
                required: ['exerciseIndex'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'solveExercise',
            description: 'Inicia el proceso de resolución de un ejercicio por parte del estudiante. Esta herramienta abrirá el modal de resolución donde el estudiante puede introducir su solución SQL para ser evaluada. Usa esta herramienta cuando el usuario indique que quiere resolver, intentar, o enviar su solución para un ejercicio.',
            parameters: {
                type: 'object',
                properties: {
                    exerciseIndex: {
                        type: 'number',
                        description: 'El índice del ejercicio en la lista de ejercicios disponibles. No es 0-based, sino directamente el que aparece al lado del ejercicio.'
                    }
                },
                required: ['exerciseIndex'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getFilteredFileContent',
            description: 'Obtiene el contenido de un archivo de texto filtrado por una expresión regular. Útil para extraer partes específicas de archivos SQL, como CREATE TABLE, INSERT, etc. sin cargar todo el contenido.',
            parameters: {
                type: 'object',
                properties: {
                    pageId: {
                        type: 'string',
                        description: 'El ID de la página donde está el archivo'
                    },
                    fileId: {
                        type: 'string',
                        description: 'El ID del archivo de texto (por ejemplo: "FILE1")'
                    },
                    regexPattern: {
                        type: 'string',
                        description: 'Expresión regular para filtrar el contenido. Ejemplos: "CREATE\\\\s+TABLE[\\\\s\\\\S]+?;\\\\n" para obtener CREATE TABLEs, "INSERT[\\\\s\\\\S]+?;\\\\n" para INSERTs'
                    }
                },
                required: ['pageId', 'fileId', 'regexPattern'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'postExercises',
            description: 'OBLIGATORIO para identificación de ejercicios: Usa esta herramienta para enviar los ejercicios identificados y toda la información recopilada. Debes llamar a esta herramienta exactamente una vez al final del análisis.',
            parameters: {
                type: 'object',
                properties: {
                    exercises: {
                        type: 'array',
                        description: 'Lista de ejercicios identificados en la página. Array vacío si no hay ejercicios.',
                        items: {
                            type: 'object',
                            properties: {
                                name: {
                                    type: 'string',
                                    description: 'El nombre o identificador del ejercicio (ej: "Ejercicio 2.1")'
                                },
                                statement: {
                                    type: 'string',
                                    description: 'El enunciado completo del ejercicio, incluyendo tablas y contexto relevante en formato Markdown'
                                }
                            },
                            required: ['name', 'statement'],
                            additionalProperties: false
                        }
                    },
                    exercise_context: {
                        type: 'string',
                        description: 'Contexto adicional relevante para los ejercicios (por ejemplo, script SQL de esquema de base de datos, especificaciones técnicas, etc.). Vacío si no hay contexto.'
                    },
                    concepts: {
                        type: 'array',
                        description: 'Lista de conceptos o instrucciones que se trabajan en los ejercicios de esta página. Array vacío si no hay conceptos.',
                        items: {
                            type: 'string'
                        }
                    },
                    learning_objectives: {
                        type: 'string',
                        description: 'Descripción breve de los objetivos de aprendizaje o conceptos que se pretenden trabajar con estos ejercicios. Vacío si no hay objetivos.'
                    }
                },
                required: ['exercises', 'exercise_context', 'concepts', 'learning_objectives'],
                additionalProperties: false
            }
        }
    }
];

/**
 * Herramientas disponibles específicamente para el ExerciseAssistant
 * Incluye getFilteredFileContent para consultar archivos de texto y postExercises para enviar la respuesta
 */
const EXERCISE_ASSISTANT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'getFilteredFileContent',
            description: 'Obtiene el contenido de un archivo de texto filtrado por una expresión regular. Útil para extraer partes específicas de archivos SQL, como CREATE TABLE, INSERT, etc. sin cargar todo el contenido.',
            parameters: {
                type: 'object',
                properties: {
                    pageId: {
                        type: 'string',
                        description: 'El ID de la página donde está el archivo'
                    },
                    fileId: {
                        type: 'string',
                        description: 'El ID del archivo de texto (por ejemplo: "FILE1")'
                    },
                    regexPattern: {
                        type: 'string',
                        description: 'Expresión regular para filtrar el contenido. Ejemplos: "CREATE\\\\s+TABLE[\\\\s\\\\S]+?;\\\\n" para obtener CREATE TABLEs, "INSERT[\\\\s\\\\S]+?;\\\\n" para INSERTs'
                    }
                },
                required: ['pageId', 'fileId', 'regexPattern'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'postExercises',
            description: 'OBLIGATORIO: Usa esta herramienta para enviar los ejercicios identificados y toda la información recopilada. Debes llamar a esta herramienta exactamente una vez al final del análisis.',
            parameters: {
                type: 'object',
                properties: {
                    exercises: {
                        type: 'array',
                        description: 'Lista de ejercicios identificados en la página. Array vacío si no hay ejercicios.',
                        items: {
                            type: 'object',
                            properties: {
                                name: {
                                    type: 'string',
                                    description: 'El nombre o identificador del ejercicio (ej: "Ejercicio 2.1")'
                                },
                                statement: {
                                    type: 'string',
                                    description: 'El enunciado completo del ejercicio, incluyendo tablas y contexto relevante en formato Markdown'
                                }
                            },
                            required: ['name', 'statement'],
                            additionalProperties: false
                        }
                    },
                    exercise_context: {
                        type: 'string',
                        description: 'Contexto adicional relevante para los ejercicios (por ejemplo, script SQL de esquema de base de datos, especificaciones técnicas, etc.). Vacío si no hay contexto.'
                    },
                    concepts: {
                        type: 'array',
                        description: 'Lista de conceptos o instrucciones que se trabajan en los ejercicios de esta página. Array vacío si no hay conceptos.',
                        items: {
                            type: 'string'
                        }
                    },
                    learning_objectives: {
                        type: 'string',
                        description: 'Descripción breve de los objetivos de aprendizaje o conceptos que se pretenden trabajar con estos ejercicios. Vacío si no hay objetivos.'
                    }
                },
                required: ['exercises', 'exercise_context', 'concepts', 'learning_objectives'],
                additionalProperties: false
            }
        }
    }
];
