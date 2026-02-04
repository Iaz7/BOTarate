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
 * File cache per page (text files and images)
 * Structure: { pageId: { fileId: FileData } }
 */
const fileCache: Map<string, Map<string, FileData>> = new Map();

/**
 * Class responsible for file management, download and conversion
 */
class FileManager {
    /**
     * Downloads a file from a URL and converts it according to its type
     * @param url URL of the file to download
     * @param fileId Unique identifier for the file (e.g., "FILE1")
     * @returns Processed file data
     */
    static async fetchAndConvertFile(url: string, fileId: string): Promise<FileData> {
        console.log(`[FileManager] Downloading file: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const mimeType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
            const filename = this.extractFilename(url, response);

            console.log(`[FileManager] File downloaded: ${filename} (${mimeType}, ${blob.size} bytes)`);

            // Determine if it is text or binary
            const isText = this.isTextMimeType(mimeType) || this.hasTextExtension(filename);

            if (isText) {
                // For text files, extract content
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
                // For binaries (images, PDFs, etc.), convert to base64
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
            console.error(`[FileManager] Error downloading file:`, error);
            throw error;
        }
    }

    /**
     * Converts a Blob to Data URL (base64)
     */
    private static async blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Convert to base64 in chunks to avoid stack overflow
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
     * Extracts the filename from the URL or Content-Disposition header
     */
    private static extractFilename(url: string, response: Response): string {
        // Try to extract from Content-Disposition
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
     * Almacena un archivo (texto o imagen) en el cache para una página
     */
    static cacheFile(pageId: string, fileData: FileData): void {
        if (!fileCache.has(pageId)) {
            fileCache.set(pageId, new Map());
        }
        fileCache.get(pageId)!.set(fileData.id, fileData);
        console.log(`[FileManager] Archivo ${fileData.id} cacheado para página ${pageId}`);
    }

    /**
     * Obtiene un archivo (texto o imagen) del cache
     */
    static getCachedFile(pageId: string, fileId: string): FileData | undefined {
        return fileCache.get(pageId)?.get(fileId);
    }

    /**
     * Obtiene el contenido de un archivo de texto filtrado por una expresión regular
     * @param pageId ID de la página donde está el archivo
     * @param fileId ID del archivo (ej: "FILE1")
     * @param regexPattern Expresión regular para filtrar el contenido
     * @returns Las coincidencias encontradas o un mensaje de error
     */
    static getFilteredTextContent(pageId: string, fileId: string, regexPattern: string): string {
        const fileData = this.getCachedFile(pageId, fileId);

        if (!fileData) {
            return `Error: No se encontró el archivo ${fileId} en la página ${pageId}`;
        }

        if (!fileData.text) {
            return `Error: El archivo ${fileId} no tiene contenido de texto`;
        }

        try {
            // Normalizar saltos de línea a \n
            const normalizedText = fileData.text.replace(/\r\n|\r/g, '\n');

            // Si el patrón viene con dobles barras, conviér14telo a una sola barra
            const normalizedPattern = regexPattern.replace(/\\/g, '\\');

            // Mostrar el patrón realmente usado para depuración
            console.log(`[FileManager] Filtrando con patrón:`, normalizedPattern);

            // Usar flags global, case-insensitive y multilinea
            const regex = new RegExp(normalizedPattern, 'gim');
            const matches = normalizedText.match(regex);

            if (!matches || matches.length === 0) {
                return `No se encontraron coincidencias para el patrón: ${regexPattern}`;
            }

            return matches.join('\n\n');
        } catch (error) {
            return `Error al procesar la expresión regular: ${error instanceof Error ? error.message : 'Error desconocido'}`;
        }
    }

    /**
     * Limpia el cache de archivos (texto e imágenes) para una página
     */
    static clearPageCache(pageId: string): void {
        fileCache.delete(pageId);
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
