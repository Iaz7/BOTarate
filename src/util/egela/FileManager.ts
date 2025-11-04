export { FileManager };

export interface FileData {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    dataUrl?: string;
    text?: string;
    url?: string;
}

/**
 * Clase responsable de la gestión, descarga y conversión de archivos
 */
class FileManager {
    /**
     * Descarga un archivo desde una URL y lo convierte según su tipo
     * @param url URL del archivo a descargar
     * @param fileId Identificador único para el archivo (ej: "FILE1")
     * @returns Datos del archivo procesado
     */
    static async fetchAndConvertFile(url: string, fileId: string): Promise<FileData> {
        console.log(`[FileManager] Descargando archivo: ${url}`);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const mimeType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
            const filename = this.extractFilename(url, response);

            console.log(`[FileManager] Archivo descargado: ${filename} (${mimeType}, ${blob.size} bytes)`);

            // Determinar si es texto o binario
            const isText = this.isTextMimeType(mimeType) || this.hasTextExtension(filename);

            if (isText) {
                // Para archivos de texto, extraer contenido
                const text = await blob.text();
                return {
                    id: fileId,
                    filename,
                    mimeType,
                    size: text.length,
                    text,
                    url
                };
            } else {
                // Para binarios (imágenes, PDFs, etc.), convertir a base64
                const dataUrl = await this.blobToDataUrl(blob, mimeType);
                return {
                    id: fileId,
                    filename,
                    mimeType,
                    size: blob.size,
                    dataUrl,
                    url
                };
            }
        } catch (error) {
            console.error(`[FileManager] Error al descargar archivo:`, error);
            throw error;
        }
    }

    /**
     * Convierte un Blob a Data URL (base64)
     */
    private static async blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convertir a base64 en chunks para evitar stack overflow
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            binary += String.fromCharCode(...chunk);
        }
        
        const base64 = btoa(binary);
        return `data:${mimeType};base64,${base64}`;
    }

    /**
     * Extrae el nombre del archivo desde la URL o el header Content-Disposition
     */
    private static extractFilename(url: string, response: Response): string {
        // Intentar extraer desde Content-Disposition
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const filenameMatch = filenameRegex.exec(contentDisposition);
            if (filenameMatch?.[1]) {
                return filenameMatch[1].replace(/['"]/g, '');
            }
        }

        // Intentar extraer desde la URL
        const urlParts = url.split('/');
        const lastPart = urlParts.at(-1);
        if (lastPart?.includes('.')) {
            return decodeURIComponent(lastPart.split('?')[0]);
        }

        return 'archivo';
    }

    /**
     * Determina si un MIME type es de texto
     */
    private static isTextMimeType(mimeType: string): boolean {
        const textTypes = [
            'text/',
            'application/json',
            'application/xml',
            'application/javascript',
            'application/sql'
        ];
        
        return textTypes.some(type => mimeType.toLowerCase().includes(type.toLowerCase()));
    }

    /**
     * Determina si una extensión de archivo sugiere contenido de texto
     */
    private static hasTextExtension(filename: string): boolean {
        const textExtensions = ['sql', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'js', 'py', 'ts', 'jsx', 'tsx'];
        const ext = filename.split('.').pop()?.toLowerCase();
        return ext ? textExtensions.includes(ext) : false;
    }

    /**
     * Determina si una URL apunta a un archivo relevante para descargar
     */
    static isRelevantFileUrl(url: string): boolean {
        // Detectar enlaces a pluginfile o ficheros con extensiones comunes
        const isPluginFile = /pluginfile\.php/.test(url);
        const fileExtMatch = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
        const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : null;
        const hasRelevantExt = ext ? ['sql', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'js', 'py', 'pdf', 'doc', 'docx'].includes(ext) : false;
        
        return isPluginFile || hasRelevantExt;
    }

    /**
     * Convierte una URL relativa a absoluta usando una base URL
     */
    static resolveUrl(url: string, baseUrl: string): string {
        try {
            return new URL(url, baseUrl).toString();
        } catch (e) {
            console.warn(`[FileManager] No se pudo resolver URL: ${url}`, e);
            return url;
        }
    }

    /**
     * Descarga un recurso de Egela siguiendo las redirecciones necesarias
     * @param resourceId ID del recurso en Egela
     * @returns Datos del archivo descargado
     */
    static async downloadResourceFile(resourceId: string): Promise<{
        blob: Blob;
        filename: string;
        mimeType: string;
        size: number;
    }> {
        console.log(`[FileManager.downloadResourceFile] Iniciando descarga del recurso: ${resourceId}`);
        
        try {
            // 1. Obtener la URL de redirección
            const viewUrl = `https://egela.ehu.eus/mod/resource/view.php?id=${resourceId}`;
            console.log(`[FileManager.downloadResourceFile] Haciendo fetch a: ${viewUrl}`);
            
            const viewResponse = await fetch(viewUrl);
            
            console.log(`[FileManager.downloadResourceFile] Respuesta recibida - Status: ${viewResponse.status}`);
            console.log(`[FileManager.downloadResourceFile] Response URL: ${viewResponse.url}`);
            console.log(`[FileManager.downloadResourceFile] Response type: ${viewResponse.type}`);
            console.log(`[FileManager.downloadResourceFile] Response redirected: ${viewResponse.redirected}`);
            
            if (viewResponse.status !== 200) {
                console.error(`[FileManager.downloadResourceFile] Status inesperado: ${viewResponse.status}`);
                throw new Error(`No se pudo acceder al recurso. Status: ${viewResponse.status}`);
            }
            
            // 2. Obtener la URL real de descarga
            let downloadUrl = viewResponse.url;
            console.log(`[FileManager.downloadResourceFile] URL de descarga inicial: ${downloadUrl}`);
            
            // Si no hubo redirección, puede ser una página intermedia con un enlace
            if (!viewResponse.redirected) {
                console.log(`[FileManager.downloadResourceFile] No hubo redirección, buscando enlace en HTML...`);
                const htmlText = await viewResponse.text();
                
                // Parsear el HTML para buscar el enlace en resourceworkaround
                const { parseHTML } = await import('linkedom');
                const { document: doc } = parseHTML(htmlText);
                const workaroundDiv = doc.querySelector('.resourceworkaround a');
                
                if (workaroundDiv) {
                    const href = workaroundDiv.getAttribute('href');
                    if (href) {
                        downloadUrl = href;
                        console.log(`[FileManager.downloadResourceFile] Enlace encontrado en HTML: ${downloadUrl}`);
                    } else {
                        console.warn(`[FileManager.downloadResourceFile] Elemento encontrado pero sin href`);
                    }
                } else {
                    console.warn(`[FileManager.downloadResourceFile] No se encontró elemento .resourceworkaround, usando URL original`);
                }
            }
            
            // 3. Descargar el archivo
            const fileResponse = await fetch(downloadUrl);
            console.log(`[FileManager.downloadResourceFile] Descarga archivo - Status: ${fileResponse.status}`);
            
            if (!fileResponse.ok) {
                console.error(`[FileManager.downloadResourceFile] Error descargando archivo: ${fileResponse.status}`);
                throw new Error(`Error descargando archivo: ${fileResponse.status}`);
            }
            
            const blob = await fileResponse.blob();
            console.log(`[FileManager.downloadResourceFile] Blob obtenido - Tamaño: ${blob.size} bytes, Tipo: ${blob.type}`);
            
            const mimeType = fileResponse.headers.get('content-type') || blob.type || 'application/octet-stream';
            console.log(`[FileManager.downloadResourceFile] MIME type final: ${mimeType}`);
            
            // 4. Extraer nombre del archivo
            const filename = this.extractFilename(downloadUrl, fileResponse);
            console.log(`[FileManager.downloadResourceFile] Filename final: ${filename}`);
            
            console.log(`[FileManager.downloadResourceFile] Descarga completada exitosamente`);
            
            return {
                blob,
                filename,
                mimeType,
                size: blob.size
            };
        } catch (error) {
            console.error(`[FileManager.downloadResourceFile] Error durante la descarga:`, error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Error desconocido al descargar el recurso');
        }
    }
}
