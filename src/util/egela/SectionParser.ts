import type { CourseSection } from "./CourseSection";
import { HtmlParserBase } from "./HtmlParserBase";

export { SectionParser };

/**
 * Parser especializado para extraer contenido de secciones de curso
 */
class SectionParser extends HtmlParserBase {
    /**
     * Parsea el contenido de una sección de curso
     * @param sectionElement Elemento HTML de la sección
     * @param section Datos de la sección (para incluir recursos)
     * @returns Texto plano con el contenido relevante de la sección
     */
    parseSection(sectionElement: any, section: CourseSection): string {
        // 1) Resumen/primer bloque descriptivo (si existe)
        const summaryText = this.extractSummary(sectionElement);

        // 2) Recursos: usar la lista de recursos que ya tenemos en la sección
        const resourceLines = this.extractResourceLines(section);

        // 3) Otros textos relevantes dentro de la sección (filtrados y únicos)
        const collected = this.extractOtherTexts(sectionElement, summaryText, resourceLines);

        // Construir resultado final: resumen + recursos + otros textos
        return this.buildResult(summaryText, resourceLines, collected);
    }

    /**
     * Extrae el texto de resumen de la sección
     */
    private extractSummary(sectionElement: any): string {
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
                    return this.normalizeSpaces(t);
                }
            }
        }

        return '';
    }

    /**
     * Extrae las líneas de recursos
     */
    private extractResourceLines(section: CourseSection): string[] {
        const resourceLines: string[] = [];
        for (const res of section.resources) {
            const title = (res.name || '').trim();
            resourceLines.push(`{Resource=${title} . id=${res.id}}`);
        }
        return resourceLines;
    }

    /**
     * Extrae otros textos relevantes de la sección
     */
    private extractOtherTexts(
        sectionElement: any, 
        summaryText: string, 
        resourceLines: string[]
    ): string[] {
        const collected: string[] = [];
        const nodes : any[] = Array.from(sectionElement.querySelectorAll('p, div, span, li'));
        
        for (const node of nodes) {
            let t = (node.textContent || '').trim();
            if (!t) continue;

            // Normalizar espacios
            t = this.normalizeSpaces(t);

            // Saltar si coincide con el resumen o ya está en recursos
            if (summaryText && t === summaryText) continue;
            if (this.isResourceText(t, resourceLines)) continue;

            // Filtrar metadatos de recursos (fechas, "Fitxategia", etc.)
            if (this.isMetadataText(t)) continue;

            // Evitar textos muy cortos o repetidos
            if (t.length < 3) continue;
            if (!collected.includes(t)) collected.push(t);
        }

        return collected;
    }

    /**
     * Verifica si un texto pertenece a un recurso
     */
    private isResourceText(text: string, resourceLines: string[]): boolean {
        const resourceRegex = /\{Resource=(.*) \. id=/;
        return resourceLines.some(r => {
            const match = resourceRegex.exec(r);
            const resourceTitle = match?.[1] || '';
            return resourceTitle && text.includes(resourceTitle);
        });
    }

    /**
     * Verifica si un texto es metadata irrelevante
     */
    private isMetadataText(text: string): boolean {
        return (
            text === 'Fitxategia' || 
            text === 'Fitxategia ikonoa' ||
            text.startsWith('Aldatze-data:') ||
            /^Alternative formats$/i.test(text)
        );
    }

    /**
     * Construye el resultado final juntando todas las partes
     */
    private buildResult(
        summaryText: string, 
        resourceLines: string[], 
        collected: string[]
    ): string {
        const parts: string[] = [];
        
        if (summaryText) {
            parts.push(summaryText);
        }
        
        if (resourceLines.length > 0) {
            parts.push('');
            parts.push(...resourceLines);
        }
        
        if (collected.length > 0) {
            parts.push('');
            parts.push(...collected);
        }

        return parts.join('\n\n');
    }
}
