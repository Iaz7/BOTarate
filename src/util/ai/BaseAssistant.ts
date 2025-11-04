import { Course } from "../egela/Course";

export { BaseAssistant };

/**
 * Clase base para asistentes de IA
 * Proporciona funcionalidad común para manejar cursos
 */
abstract class BaseAssistant {
    protected course: Course | null = null;

    /**
     * Establece el curso actual para el asistente
     */
    setCourse(course: Course): void {
        this.course = course;
    }

    /**
     * Obtiene el curso actual
     */
    getCourse(): Course | null {
        return this.course;
    }

    /**
     * Verifica que haya un curso cargado
     * @throws Error si no hay curso cargado
     */
    protected ensureCourseLoaded(): void {
        if (!this.course) {
            throw new Error('No hay curso cargado');
        }
    }

    /**
     * Ejecutor de herramientas compartido por todos los asistentes
     * Proporciona acceso a getSectionContent y getResourceContent
     */
    protected async executeToolCall(
        name: string,
        args: any
    ): Promise<string | { type: 'file'; data: any }> {
        this.ensureCourseLoaded();

        if (name === 'getSectionContent') {
            return await this.course!.getSectionContent(args.sectionId);
        }

        if (name === 'getResourceContent') {
            const fileData = await this.course!.getResourceFile(args.resourceId);

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

                return {
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
                return `Archivo: ${fileData.resourceName} (${fileData.filename})\nTipo: ${fileData.mimeType}\nTamaño: ${(fileData.size / 1024).toFixed(2)} KB\n\nCONTENIDO:\n${text}`;
            } else {
                // Formato no soportado, solo metadatos
                return JSON.stringify({
                    type: 'metadata_only',
                    resourceName: fileData.resourceName,
                    filename: fileData.filename,
                    mimeType: fileData.mimeType,
                    size: fileData.size,
                    message: `Archivo de tipo ${fileData.mimeType} - No se puede procesar el contenido directamente. Tamaño: ${(fileData.size / 1024 / 1024).toFixed(2)} MB`
                });
            }
        }

        throw new Error(`Herramienta desconocida: ${name}`);
    }
}
