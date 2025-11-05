import { Course } from "../egela/Course";

export class ToolFunctions {
    /**
     * Obtiene el contenido de una sección del curso
     */
    static async getSectionContent(course: Course, args: { sectionId: string }): Promise<string> {
        return await course.getSectionContent(args.sectionId);
    }

    /**
     * Obtiene el contenido de una página del curso
     */
    static async getPageContent(course: Course, args: { pageId: string }): Promise<string> {
        return (await course.getPageContent(args.pageId)).markdown;
    }

    /**
     * Obtiene el contenido de un recurso del curso
     * Soporta imágenes, PDFs, texto y HTML
     */
    static async getResourceContent(
        course: Course, 
        args: { resourceId: string }
    ): Promise<string | { type: 'file'; data: any }> {
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
            return await this.convertFileToBase64(fileData);
        } else if (isSupported) {
            // Para texto/HTML, extraer contenido
            return await this.extractTextContent(fileData);
        } else {
            // Formato no soportado, solo metadatos
            return this.getMetadataOnly(fileData);
        }
    }

    /**
     * Convierte un archivo (imagen o PDF) a base64
     */
    private static async convertFileToBase64(fileData: any): Promise<{ type: 'file'; data: any }> {
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
    }

    /**
     * Extrae el contenido de texto de un archivo
     */
    private static async extractTextContent(fileData: any): Promise<string> {
        const text = await fileData.blob.text();
        return `Archivo: ${fileData.resourceName} (${fileData.filename})\nTipo: ${fileData.mimeType}\nTamaño: ${(fileData.size / 1024).toFixed(2)} KB\n\nCONTENIDO:\n${text}`;
    }

    /**
     * Retorna solo los metadatos para archivos no soportados
     */
    private static getMetadataOnly(fileData: any): string {
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
