export { TOOLS };
export type { ToolCall, ToolName, ToolResult };

/**
 * Nombres de las herramientas disponibles para el LLM
 */
type ToolName = 'getSectionContent' | 'getPageContent' | 'getResourceContent';

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
    }
];
