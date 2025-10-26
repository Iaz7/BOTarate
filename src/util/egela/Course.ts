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

class Course {
    id: string;
    //numSections: number;
    baseUrl: string;
    highlighted: string;
    //editMode: boolean;
    sections: CourseSection[];
    //stateKey: string;

    constructor(data: any) {
        const courseInfo = data.course;
        this.id = courseInfo.id;
        //this.numSections = courseInfo.numsections;
        this.baseUrl = courseInfo.baseurl;
        this.highlighted = courseInfo.highlighted;
        //this.editMode = courseInfo.editmode;
        //this.stateKey = courseInfo.statekey;

        this.sections = data.section.map((sectionData: any) =>
            new CourseSection(sectionData, data.cm, this.baseUrl)
        );
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

    /**
     * Obtiene el archivo de un recurso descargable
     * @param resourceId - ID del recurso
     * @returns Información del archivo descargado
     * @throws Error si el recurso no existe o no es descargable
     */
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
            
            // 2. Obtener la URL real de descarga desde la respuesta
            let downloadUrl = viewResponse.url;
            console.log(`[getResourceFile] URL de descarga inicial: ${downloadUrl}`);
            
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
}