/// <reference types="chrome"/>

import { OpenAIService } from "../util/ai/OpenAIService";
import { ConfigManager } from "../util/config/ConfigManager";
import { Course } from "../util/egela/Course";

let course: Course;
let isConfigLoaded = false;

(async () => {
    try {
        await ConfigManager.loadConfig();
        isConfigLoaded = true;
        console.log("Configuración cargada en background script");
    } catch (e) {
        console.error('No se pudo cargar la configuración en background:', e);
    }
})();

chrome.runtime.onInstalled.addListener(() => {
    console.log("La extensión ha sido instalada.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    console.log("[REQUEST] " + JSON.stringify(request.action));

    // Esperar a que la configuración esté cargada antes de procesar mensajes
    if (!isConfigLoaded) {
        ConfigManager.loadConfig().then(() => {
            isConfigLoaded = true;
            processMessage(request, sender, sendResponse);
        });
        return true; // Mantener el canal abierto para la respuesta asíncrona
    }

    return processMessage(request, sender, sendResponse);
});

function processMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {
    switch (request.action) {
        case "updateConfig":
            if (request.config) {
                const { providerKeys, selectedProvider, selectedModel } = request.config;
                if (providerKeys) {
                    for (let index = 0; index < providerKeys.length; index++) {
                        ConfigManager.setProviderKey(index, providerKeys[index]);
                    }
                }

                if (selectedProvider !== undefined) {
                    ConfigManager.selectProvider(selectedProvider);
                }
                if (selectedModel !== undefined) {
                    ConfigManager.selectModel(selectedModel);
                }

                console.log("Configuración actualizada en background desde options");
                sendResponse({ success: true });
            }
            return false;
        case "getCourseData":
            course = new Course(request.courseData);
            sendResponse(course);
            console.log(course);
            
            return true;
        case "getModelList":
            OpenAIService.getModelList().then((list: any) => sendResponse(list));
            return true;
        case "generateResponse": {
            const { userMessage, resetHistory } = request;

            console.log("Generando respuesta LLM en background...");
            
            // Resetear historial si se solicita
            if (resetHistory) {
                OpenAIService.resetConversation();
            }

            // Construir system prompt completo con información del curso
            let fullSystemPrompt = '';
            
            if (resetHistory && course) {
                const courseContext : string = JSON.stringify(course);
                fullSystemPrompt = `Eres un asistente en una extensión de Chrome cuyo objetivo es ayudar a estudiantes con el contenido de sus cursos en Egela (plataforma educativa de la Universidad del País Vasco).

INFORMACIÓN DEL CURSO:
A continuación tienes la estructura completa del curso con todas las secciones disponibles. Cada sección tiene un ID único que debes usar cuando necesites obtener su contenido detallado.

${courseContext}

INSTRUCCIONES IMPORTANTES:
- Cuando el usuario mencione una sección por su título/nombre, busca su ID en la lista de sections anterior. El usuario no conoce los IDs, solo los títulos, así que no debes preguntarle el ID, sino buscarlo.
- Para obtener el contenido detallado de una sección, usa la herramienta getSectionContent con el ID de la sección
- Los IDs de las secciones son los valores del campo "id" (por ejemplo: "1378079")
- Cada sección tiene recursos con sus propios IDs que también puedes referenciar
- Si el usuario pide información sobre "la sección 2" o "tema 2", busca la sección con sectionNumber: 2 y usa su ID
- Responde de forma directa, útil y concisa
- Si necesitas información sobre una sección específica, llama a getSectionContent para obtenerla antes de responder`;
            }

            // Función recursiva para manejar tool calls
            const handleResponse = async (): Promise<string> => {
                const result = await OpenAIService.generateResponseWithTools(userMessage, fullSystemPrompt);

                if (result.type === 'message') {
                    // Respuesta final del LLM
                    return result.content;
                }

                // El LLM quiere llamar a herramientas
                console.log(`LLM solicita ${result.calls.length} tool call(s)`);

                // Ejecutar todas las tool calls
                for (const call of result.calls) {
                    console.log(`Ejecutando tool: ${call.function.name}`);
                    
                    try {
                        const args = JSON.parse(call.function.arguments);
                        let toolResult: string | { type: 'file'; data: any } = '';

                        // Ejecutar la función correspondiente
                        if (call.function.name === 'getSectionContent') {
                            toolResult = await course.getSectionContent(args.sectionId);
                        } else if (call.function.name === 'getResourceContent') {
                            const fileData = await course.getResourceFile(args.resourceId);
                            
                            // Determinar si el archivo es compatible con la API
                            const supportedMimeTypes = [
                                'application/pdf',
                                'image/png',
                                'image/jpeg',
                                'image/jpg',
                                'image/gif',
                                'image/webp',
                                'text/html',
                                'text/plain',
                                'text/markdown'
                            ];
                            
                            const isSupported = supportedMimeTypes.some(type => 
                                fileData.mimeType.toLowerCase().includes(type.toLowerCase())
                            );
                            
                            if (isSupported && (fileData.mimeType.startsWith('image/') || fileData.mimeType === 'application/pdf')) {
                                // Para imágenes y PDFs, convertir a base64 y enviar como parte del mensaje
                                const arrayBuffer = await fileData.blob.arrayBuffer();
                                const uint8Array = new Uint8Array(arrayBuffer);
                                
                                // Convertir a base64 en chunks para evitar stack overflow
                                let binary = '';
                                const chunkSize = 8192;
                                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                                    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                                    binary += String.fromCharCode(...chunk);
                                }
                                const base64 = btoa(binary);
                                const dataUrl = `data:${fileData.mimeType};base64,${base64}`;
                                
                                console.log(`[getResourceContent] PDF/Imagen convertido a base64, tamaño: ${base64.length} caracteres`);
                                
                                // Para PDFs e imágenes, devolver un objeto especial que indica que hay que adjuntar el archivo
                                toolResult = {
                                    type: 'file',
                                    data: {
                                        resourceName: fileData.resourceName,
                                        filename: fileData.filename,
                                        mimeType: fileData.mimeType,
                                        size: fileData.size,
                                        dataUrl: dataUrl
                                    }
                                };
                            } else if (isSupported) {
                                // Para texto/HTML, extraer contenido
                                const text = await fileData.blob.text();
                                toolResult = `Archivo: ${fileData.resourceName} (${fileData.filename})\nTipo: ${fileData.mimeType}\nTamaño: ${(fileData.size / 1024).toFixed(2)} KB\n\nCONTENIDO:\n${text}`;
                            } else {
                                // Formato no soportado, solo metadatos
                                toolResult = JSON.stringify({
                                    type: 'metadata_only',
                                    resourceName: fileData.resourceName,
                                    filename: fileData.filename,
                                    mimeType: fileData.mimeType,
                                    size: fileData.size,
                                    message: `Archivo de tipo ${fileData.mimeType} - No se puede procesar el contenido directamente. Tamaño: ${(fileData.size / 1024 / 1024).toFixed(2)} MB`
                                });
                            }
                        } else {
                            toolResult = `Error: herramienta desconocida ${call.function.name}`;
                        }

                        console.log(`Resultado de ${call.function.name}:`, 
                            typeof toolResult === 'string' ? toolResult : '[Archivo]');

                        // Agregar resultado al historial
                        if (typeof toolResult === 'object' && toolResult.type === 'file') {
                            // Para archivos (PDFs/imágenes), agregar el resultado del tool y luego el archivo como mensaje de usuario
                            OpenAIService.addToolResult(
                                call.id, 
                                call.function.name, 
                                `Archivo adjuntado: ${toolResult.data.filename} (${toolResult.data.mimeType}, ${(toolResult.data.size / 1024).toFixed(2)} KB)`
                            );
                            
                            // Agregar el archivo como un mensaje multimodal del usuario
                            OpenAIService.addFileMessage(
                                toolResult.data.filename,
                                toolResult.data.dataUrl,
                                toolResult.data.mimeType
                            );
                        } else {
                            OpenAIService.addToolResult(call.id, call.function.name, toolResult as string);
                        }
                    } catch (error) {
                        console.error(`Error ejecutando ${call.function.name}:`, error);
                        OpenAIService.addToolResult(
                            call.id,
                            call.function.name,
                            `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
                        );
                    }
                }

                // Llamar recursivamente para obtener la respuesta final
                return handleResponse();
            };

            handleResponse()
                .then(finalResponse => sendResponse(finalResponse))
                .catch(error => {
                    console.error('Error en generateResponse:', error);
                    sendResponse(`Error: ${error.message}`);
                });

            return true;
        }

        default:
            return false;
    }
}