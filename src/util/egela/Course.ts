import { parseHTML } from 'linkedom';
import { CourseSection } from "./CourseSection";

export { Course };

/**
 * Función auxiliar para obtener el HTML de una sección
 * Puede ser llamada directamente o a través de chrome.runtime.sendMessage
 */
export async function fetchSectionHtml(courseId: string, sectionNumber: number): Promise<string> {
    const url = `https://egela.ehu.eus/course/view.php?id=${courseId}&section=${sectionNumber}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.text();
}

/**
 * Función auxiliar para obtener el HTML de una página
 */
export async function fetchPageHtml(pageId: string): Promise<string> {
    const url = `https://egela.ehu.eus/mod/page/view.php?id=${pageId}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.text();
}

class Course {
    id: string;
    baseUrl: string;
    highlighted: string;
    sections: CourseSection[];

    constructor(data: any) {
        const courseInfo = data.course;
        this.id = courseInfo.id;
        this.baseUrl = courseInfo.baseurl;
        this.highlighted = courseInfo.highlighted;

        this.sections = data.section.map((sectionData: any) =>
            new CourseSection(sectionData, data.cm, this.baseUrl)
        );
    }

    /**
     * Crea una instancia de Course desde un href y el sessionStorage
     * @param href URL actual de la página
     * @param sessionStorageData Objeto con todos los datos de sessionStorage
     * @returns Una instancia de Course o null si no se encuentra
     */
    static async fromHrefAndStorage(href: string, sessionStorageData: Record<string, string>): Promise<Course | null> {
        console.log('[Course.fromHrefAndStorage] Analizando URL:', href);
        console.log('[Course.fromHrefAndStorage] Datos de sessionStorage recibidos:', Object.keys(sessionStorageData));
        
        // Caso 1: Estamos en una vista de curso (course/view.php?id=...)
        if (href.includes('egela.ehu.eus/course/view.php?id=')) {
            const courseId = new URL(href).searchParams.get('id');
            if (!courseId) return null;

            console.log('[Course.fromHrefAndStorage] Detectado courseId:', courseId);
            
            // Buscar datos del curso en sessionStorage
            const courseKey = `-716233041/course/${courseId}/staticState`;
            const courseDataStr = sessionStorageData[courseKey];
            
            if (!courseDataStr) {
                console.error('[Course.fromHrefAndStorage] No se encontraron datos del curso en sessionStorage');
                return null;
            }

            try {
                const courseData = JSON.parse(courseDataStr);
                return new Course(courseData);
            } catch (error) {
                console.error('[Course.fromHrefAndStorage] Error al parsear datos del curso:', error);
                return null;
            }
        }

        // Caso 2: Estamos en una página/recurso (mod/page/view.php?id=...)
        if (href.includes('egela.ehu.eus/mod/')) {
            const resourceId = new URL(href).searchParams.get('id');
            if (!resourceId) return null;

            console.log('[Course.fromHrefAndStorage] Detectado resourceId:', resourceId);
            console.log('[Course.fromHrefAndStorage] Buscando curso que contenga este recurso...');

            // Buscar en todos los cursos del sessionStorage
            for (const [key, value] of Object.entries(sessionStorageData)) {
                if (!key.includes('-716233041/course/') || !key.endsWith('/staticState')) continue;

                try {
                    const courseData = JSON.parse(value);
                    
                    // Verificar si este curso contiene el recurso
                    const hasResource = courseData.cm?.some((cm: any) => cm.id === resourceId);
                    
                    if (hasResource) {
                        console.log('[Course.fromHrefAndStorage] Curso encontrado!');
                        return new Course(courseData);
                    }
                } catch (error) {
                    // Ignorar errores de parsing para otros datos
                    continue;
                }
            }

            console.error('[Course.fromHrefAndStorage] No se encontró ningún curso con el recurso:', resourceId);
            return null;
        }

        console.log('[Course.fromHrefAndStorage] URL no reconocida como curso o recurso de Egela');
        return null;
    }

    getSectionById(sectionId: string): CourseSection | undefined {
        return this.sections.find(section => section.id === sectionId);
    }

    getSectionByNumber(sectionNumber: number): CourseSection | undefined {
        return this.sections.find(section => section.section === sectionNumber);
    }

    /*getVisibleSections(): CourseSection[] {
        return this.sections.filter(section => section.visible);
    }*/

    getAllDownloadableResources() {
        const allResources = [];
        for (const section of this.sections) {
            allResources.push(...section.getDownloadableResources());
        }
        return allResources;
    }

    getSectionsWithResources(): CourseSection[] {
        return this.sections.filter(section => section.hasResources());
    }

    getCourseUrl(): string {
        return this.baseUrl;
    }

    async getSectionContent(sectionId: string): Promise<string> {
        // Verificar que la sección existe en el curso
        const section = this.getSectionById(sectionId);
        if (!section) {
            throw new Error(`La sección con id '${sectionId}' no existe en el curso`);
        }

        console.log("La sección existe, procediendo a obtener su contenido...");

        try {
            // Obtener el HTML de la sección directamente (estamos en background)
            const html = await fetchSectionHtml(this.id, section.section);
            console.log("HTML obtenido, longitud:", html.length);

            // Parsear el HTML recibido usando linkedom (compatible con Service Workers)
            const { document: doc } = parseHTML(html);

            // Buscar el elemento de la sección usando querySelector
            const sectionElementId = `section-${section.section}`;
            const sectionElement = doc.querySelector(`li#${sectionElementId}.section.course-section`);

            if (!sectionElement) {
                throw new Error(`No se encontró el elemento HTML de la sección con id: ${sectionElementId}`);
            }

            // EXTRAER TEXTO IMPORTANTE
            // 1) Resumen/primer bloque descriptivo (si existe)
            let summaryText = '';
            const summarySelectors = [
                '.course-description-item .description-inner',
                '.summarytext .description-inner',
                '.description-inner',
                '.no-overflow',
                'p'
            ];

            for (const sel of summarySelectors) {
                const el = sectionElement.querySelector(sel);
                if (el) {
                    const t = (el.textContent || '').trim();
                    if (t.length > 0) {
                        summaryText = t.replace(/\s+/g, ' ');
                        break;
                    }
                }
            }

            // 2) Recursos: usar la lista de recursos que ya tenemos en la sección
            const resourceLines: string[] = [];
            for (const res of section.resources) {
                // Incluir título y id
                const title = (res.name || '').trim();
                resourceLines.push(`{Resource=${title} . id=${res.id}}`);
            }

            // 3) Otros textos relevantes dentro de la sección (filtrados y únicos)
            const collected: string[] = [];
            const nodes = Array.from(sectionElement.querySelectorAll('p, div, span, li'));
            for (const node of nodes) {
                let t = (node.textContent || '').trim();
                if (!t) continue;
                // Normalizar espacios
                t = t.replace(/\s+/g, ' ');
                // Saltar si coincide con el resumen o ya está en recursos
                if (summaryText && t === summaryText) continue;
                if (resourceLines.some(r => t.includes((r.match(/\{Resource=(.*) \. id=/) || [])[1] || ''))) continue;
                // Filtrar metadatos de recursos (fechas, "Fitxategia", etc.)
                if (t === 'Fitxategia' || t === 'Fitxategia ikonoa') continue;
                if (t.startsWith('Aldatze-data:')) continue;
                if (/^Alternative formats$/i.test(t)) continue;
                // Evitar textos muy cortos o repetidos
                if (t.length < 3) continue;
                if (!collected.includes(t)) collected.push(t);
            }

            // Construir resultado final: resumen + recursos + otros textos
            const parts: string[] = [];
            if (summaryText) parts.push(summaryText);
            if (resourceLines.length > 0) {
                parts.push('');
                parts.push(...resourceLines);
            }
            if (collected.length > 0) {
                parts.push('');
                parts.push(...collected);
            }

            const result = parts.join('\n\n');
            return result;

        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Error desconocido al obtener el contenido de la sección');
        }
    }

    async getResourceFile(resourceId: string): Promise<{
        blob: Blob;
        filename: string;
        mimeType: string;
        size: number;
        resourceName: string;
    }> {
        console.log(`[getResourceFile] Iniciando descarga del recurso: ${resourceId}`);
        
        // Verificar que el recurso existe en alguna sección
        let foundResource = null;
        for (const section of this.sections) {
            const resource = section.resources.find(r => r.id === resourceId);
            if (resource) {
                foundResource = resource;
                break;
            }
        }

        if (!foundResource) {
            console.error(`[getResourceFile] Recurso no encontrado: ${resourceId}`);
            throw new Error(`El recurso con id '${resourceId}' no existe en el curso`);
        }

        console.log(`[getResourceFile] Recurso encontrado: ${foundResource.name}`);

        if (!foundResource.isDownloadable()) {
            console.error(`[getResourceFile] Recurso no descargable: ${foundResource.name}`);
            throw new Error(`El recurso '${foundResource.name}' no es descargable`);
        }

        try {
            // 1. Obtener la URL de redirección
            const viewUrl = `https://egela.ehu.eus/mod/resource/view.php?id=${resourceId}`;
            console.log(`[getResourceFile] Haciendo fetch a: ${viewUrl}`);
            
            const viewResponse = await fetch(viewUrl);
            
            console.log(`[getResourceFile] Respuesta recibida - Status: ${viewResponse.status}`);
            console.log(`[getResourceFile] Response URL: ${viewResponse.url}`);
            console.log(`[getResourceFile] Response type: ${viewResponse.type}`);
            console.log(`[getResourceFile] Response redirected: ${viewResponse.redirected}`);
            
            if (viewResponse.status !== 200) {
                console.error(`[getResourceFile] Status inesperado: ${viewResponse.status}`);
                throw new Error(`No se pudo acceder al recurso. Status: ${viewResponse.status}`);
            }
            
            // 2. Obtener la URL real de descarga
            let downloadUrl = viewResponse.url;
            console.log(`[getResourceFile] URL de descarga inicial: ${downloadUrl}`);
            
            // Si no hubo redirección, puede ser una página intermedia con un enlace
            if (!viewResponse.redirected) {
                console.log(`[getResourceFile] No hubo redirección, buscando enlace en HTML...`);
                const htmlText = await viewResponse.text();
                
                // Parsear el HTML para buscar el enlace en resourceworkaround
                const { document: doc } = parseHTML(htmlText);
                const workaroundDiv = doc.querySelector('.resourceworkaround a');
                
                if (workaroundDiv) {
                    const href = workaroundDiv.getAttribute('href');
                    if (href) {
                        downloadUrl = href;
                        console.log(`[getResourceFile] Enlace encontrado en HTML: ${downloadUrl}`);
                    } else {
                        console.warn(`[getResourceFile] Elemento encontrado pero sin href`);
                    }
                } else {
                    console.warn(`[getResourceFile] No se encontró elemento .resourceworkaround, usando URL original`);
                }
            }
            
            // 3. Descargar el archivo
            const fileResponse = await fetch(downloadUrl);
            console.log(`[getResourceFile] Descarga archivo - Status: ${fileResponse.status}`);
            
            if (!fileResponse.ok) {
                console.error(`[getResourceFile] Error descargando archivo: ${fileResponse.status}`);
                throw new Error(`Error descargando archivo: ${fileResponse.status}`);
            }
            
            const blob = await fileResponse.blob();
            console.log(`[getResourceFile] Blob obtenido - Tamaño: ${blob.size} bytes, Tipo: ${blob.type}`);
            
            const mimeType = fileResponse.headers.get('content-type') || blob.type || 'application/octet-stream';
            console.log(`[getResourceFile] MIME type final: ${mimeType}`);
            
            // 4. Extraer nombre del archivo desde Content-Disposition o URL
            let filename = 'archivo';
            const contentDisposition = fileResponse.headers.get('content-disposition');
            console.log(`[getResourceFile] Content-Disposition: ${contentDisposition}`);
            
            if (contentDisposition) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const filenameMatch = filenameRegex.exec(contentDisposition);
                if (filenameMatch?.[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                    console.log(`[getResourceFile] Filename extraído de Content-Disposition: ${filename}`);
                }
            } else {
                // Intentar extraer desde la URL
                const urlParts = downloadUrl.split('/');
                const lastPart = urlParts.at(-1);
                if (lastPart?.includes('.')) {
                    filename = decodeURIComponent(lastPart.split('?')[0]);
                    console.log(`[getResourceFile] Filename extraído de URL: ${filename}`);
                }
            }
            
            console.log(`[getResourceFile] Descarga completada exitosamente`);
            
            return {
                blob,
                filename,
                mimeType,
                size: blob.size,
                resourceName: foundResource.name
            };
        } catch (error) {
            console.error(`[getResourceFile] Error durante la descarga:`, error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Error desconocido al descargar el recurso');
        }
    }

    /**
     * Obtiene el contenido de una página de ejercicios parseado en formato Markdown
     * @param pageId ID de la página (por ejemplo: "9210914")
     * @returns El contenido de la página en formato Markdown
     */
    async getPageContent(pageId: string): Promise<{ markdown: string; files: Array<{ id: string; filename: string; mimeType: string; size: number; dataUrl?: string; text?: string; url?: string }> }> {
        console.log(`[getPageContent] Obteniendo contenido de la página: ${pageId}`);
        
        try {
            // 1. Obtener el HTML de la página
            const html = await fetchPageHtml(pageId);
            console.log(`[getPageContent] HTML obtenido, longitud: ${html.length}`);

            // 2. Parsear el HTML usando linkedom
            const { document: doc } = parseHTML(html);

            // 3. Buscar el contenedor principal de contenido
            const mainContent = doc.querySelector('div[role="main"]');
            
            if (!mainContent) {
                throw new Error('No se encontró el contenido principal de la página');
            }

            // 4. Parsear el contenido a Markdown y detectar archivos
            const result = await this.parseHtmlToMarkdownWithFiles(mainContent, pageId);
            
            console.log(`[getPageContent] Contenido parseado exitosamente, longitud: ${result.markdown.length}, archivos: ${result.files.length}`);
            return result;

        } catch (error) {
            console.error(`[getPageContent] Error al obtener el contenido de la página:`, error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Error desconocido al obtener el contenido de la página');
        }
    }

    /**
     * Parsea un elemento HTML a formato Markdown
     * Maneja texto, encabezados, párrafos y tablas
     */
    private async parseHtmlToMarkdownWithFiles(element: any, pageId: string): Promise<{ markdown: string; files: Array<{ id: string; filename: string; mimeType: string; size: number; dataUrl?: string; text?: string; url?: string }> }> {
        const lines: string[] = [];
        const files: Array<{ id: string; filename: string; mimeType: string; size: number; dataUrl?: string; text?: string; url?: string }> = [];
        
        // Función auxiliar para limpiar texto
        const cleanText = (text: string): string => {
            return text
                .replace(/\s+/g, ' ')  // Normalizar espacios
                .replace(/&nbsp;/g, ' ')
                .trim();
        };

        // Función auxiliar para parsear una tabla
        const parseTable = (table: any): string[] => {
            const tableLines: string[] = [];
            const rows = Array.from(table.querySelectorAll('tr'));
            
            if (rows.length === 0) return tableLines;

            // Procesar cada fila
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i] as any;
                const cells = Array.from(row.querySelectorAll('td, th'));
                const cellTexts = cells.map((cell: any) => cleanText(cell.textContent || ''));
                
                // Crear fila de tabla en Markdown
                tableLines.push('| ' + cellTexts.join(' | ') + ' |');
                
                // Agregar línea separadora después de la primera fila (header)
                if (i === 0) {
                    tableLines.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |');
                }
            }
            
            return tableLines;
        };

        // Función recursiva para procesar nodos
        const processNode = async (node: any): Promise<void> => {
            const tagName = node.tagName?.toLowerCase();

            // Saltar elementos que no nos interesan
            if (
                tagName === 'script' ||
                tagName === 'style' ||
                tagName === 'noscript' ||
                node.classList?.contains('ally-actions') ||
                node.classList?.contains('ally-image-cover') ||
                node.getAttribute?.('aria-hidden') === 'true'
            ) {
                return;
            }

            // Procesar según el tipo de elemento
            switch (tagName) {
                case 'h1':
                    lines.push('\n# ' + cleanText(node.textContent));
                    break;
                case 'h2':
                    lines.push('\n## ' + cleanText(node.textContent));
                    break;
                case 'h3':
                    lines.push('\n### ' + cleanText(node.textContent));
                    break;
                case 'h4':
                    lines.push('\n#### ' + cleanText(node.textContent));
                    break;
                case 'h5':
                    lines.push('\n##### ' + cleanText(node.textContent));
                    break;
                case 'h6':
                    lines.push('\n###### ' + cleanText(node.textContent));
                    break;
                case 'table':
                    lines.push('\n');
                    lines.push(...parseTable(node));
                    lines.push('\n');
                    break;
                case 'img': {
                    const src = node.getAttribute('src') || node.getAttribute('data-src');
                    if (src) {
                        // Resolver URL absoluta
                        let abs = src;
                        try { abs = new URL(src, `https://egela.ehu.eus/mod/page/view.php?id=${pageId}`).toString(); } catch(e){}

                        const fileId = `FILE${files.length + 1}`;
                        try {
                            const resp = await fetch(abs);
                            if (resp.ok) {
                                const blob = await resp.blob();
                                const arrayBuffer = await blob.arrayBuffer();
                                const uint8Array = new Uint8Array(arrayBuffer);
                                let binary = '';
                                const chunkSize = 8192;
                                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                                    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                                    binary += String.fromCharCode(...chunk);
                                }
                                const base64 = btoa(binary);
                                const dataUrl = `data:${blob.type};base64,${base64}`;
                                files.push({ id: fileId, filename: abs.split('/').pop() || fileId, mimeType: blob.type, size: blob.size, dataUrl, url: abs });
                                // Insertar marcador en el markdown
                                lines.push(`[${fileId}]`);
                            } else {
                                lines.push(`[IMAGE MISSING]`);
                            }
                        } catch (err) {
                            console.warn('[parseHtmlToMarkdownWithFiles] Error fetching image', err);
                            lines.push(`[${fileId}]`);
                        }
                    }
                    break;
                }
                case 'a': {
                    const href = node.getAttribute('href');
                    const text = cleanText(node.textContent || '');
                    if (href) {
                        let abs = href;
                        try { abs = new URL(href, `https://egela.ehu.eus/mod/page/view.php?id=${pageId}`).toString(); } catch(e){}

                        // Detectar enlaces a pluginfile o ficheros con extensiones comunes
                        const isPluginFile = /pluginfile\.php/.test(abs);
                        const fileExtMatch = abs.match(/\.([a-zA-Z0-9]+)(?:[?\#]|$)/);
                        const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : null;
                        const textLikeExt = ['sql','txt','md','csv','json','xml','html','js','py'].includes(ext || '');

                        if (isPluginFile || textLikeExt) {
                            const fileId = `FILE${files.length + 1}`;
                            try {
                                const resp = await fetch(abs);
                                if (resp.ok) {
                                    const blob = await resp.blob();
                                    const mime = resp.headers.get('content-type') || blob.type || 'application/octet-stream';
                                    if (mime.startsWith('text/') || textLikeExt) {
                                        const textContent = await resp.text();
                                        files.push({ id: fileId, filename: abs.split('/').pop() || fileId, mimeType: mime, size: textContent.length, text: textContent, url: abs });
                                    } else {
                                        // binario: convertir a base64
                                        const arrayBuffer = await blob.arrayBuffer();
                                        const uint8Array = new Uint8Array(arrayBuffer);
                                        let binary = '';
                                        const chunkSize = 8192;
                                        for (let i = 0; i < uint8Array.length; i += chunkSize) {
                                            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                                            binary += String.fromCharCode(...chunk);
                                        }
                                        const base64 = btoa(binary);
                                        const dataUrl = `data:${mime};base64,${base64}`;
                                        files.push({ id: fileId, filename: abs.split('/').pop() || fileId, mimeType: mime, size: blob.size, dataUrl, url: abs });
                                    }
                                    // Insertar marcador junto al texto del enlace
                                    if (text) lines.push(`${text} [${fileId}]`); else lines.push(`[${fileId}]`);
                                } else {
                                    if (text) lines.push(text);
                                }
                            } catch (err) {
                                console.warn('[parseHtmlToMarkdownWithFiles] Error fetching file link', err);
                                if (text) lines.push(text);
                            }
                            break;
                        }
                    }
                    // si no es un fichero relevante, seguir procesando su contenido
                    for (const child of Array.from(node.children || [])) {
                        // eslint-disable-next-line no-await-in-loop
                        await processNode(child);
                    }
                    if (text) {
                        // Añadir el texto del enlace si existe
                        lines.push(text);
                    }
                    break;
                }
                case 'p':
                case 'div':
                case 'span': {
                    // Solo agregar si tiene contenido de texto directo
                    const text = cleanText(node.textContent || '');
                    
                    // Evitar duplicados y contenido vacío
                    if (text && text.length > 0 && !lines.includes(text)) {
                        // Si el nodo no tiene hijos relevantes o solo texto, agregarlo
                        const hasRelevantChildren = Array.from(node.children || []).some(
                            (child: any) => {
                                const childTag = child.tagName?.toLowerCase();
                                return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'p'].includes(childTag);
                            }
                        );
                        
                        if (!hasRelevantChildren && text !== '&nbsp;') {
                            lines.push(text);
                        }
                    }
                    
                    // Procesar hijos
                    for (const child of Array.from(node.children || [])) {
                        // permitir await en profundidad
                        // eslint-disable-next-line no-await-in-loop
                        await processNode(child);
                    }
                    break;
                }
                default:
                    // Para otros elementos, procesar sus hijos
                    for (const child of Array.from(node.children || [])) {
                        // eslint-disable-next-line no-await-in-loop
                        await processNode(child);
                    }
                    break;
            }
        };

        // Iniciar el procesamiento
        // eslint-disable-next-line no-await-in-loop
        await processNode(element);

        // Filtrar líneas vacías consecutivas y limpiar
        const filteredLines: string[] = [];
        let lastWasEmpty = false;
        
        for (const line of lines) {
            const isEmpty = line.trim().length === 0;
            
            if (!isEmpty) {
                filteredLines.push(line);
                lastWasEmpty = false;
            } else if (!lastWasEmpty) {
                filteredLines.push('');
                lastWasEmpty = true;
            }
        }

        return {
            markdown: filteredLines.join('\n').trim(),
            files
        };
    }
}