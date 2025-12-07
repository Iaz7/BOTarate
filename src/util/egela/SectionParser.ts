import type { CourseSection } from "./CourseSection";
import { HtmlParserBase } from "./HtmlParserBase";

export { SectionParser };

/**
 * Specialized parser for extracting course section content
 */
class SectionParser extends HtmlParserBase {
    /**
     * Parses the content of a course section
     * @param sectionElement HTML element of the section
     * @param section Section data (to include resources)
     * @returns Plain text with relevant section content
     */
    parseSection(sectionElement: any, section: CourseSection): string {
        // 1) Summary/first descriptive block (if exists)
        const summaryText = this.extractSummary(sectionElement);

        // 2) Resources: use the list of resources we already have in the section
        const resourceLines = this.extractResourceLines(section);

        // 3) Other relevant texts within the section (filtered and unique)
        const collected = this.extractOtherTexts(sectionElement, summaryText, resourceLines);

        // Build final result: summary + resources + other texts
        return this.buildResult(summaryText, resourceLines, collected);
    }

    /**
     * Extracts the summary text of the section
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
     * Extracts resource lines
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
     * Extracts other relevant texts from the section
     */
    private extractOtherTexts(
        sectionElement: any,
        summaryText: string,
        resourceLines: string[]
    ): string[] {
        const collected: string[] = [];
        const nodes: any[] = Array.from(sectionElement.querySelectorAll('p, div, span, li'));

        for (const node of nodes) {
            let t = (node.textContent || '').trim();
            if (!t) continue;

            // Normalize spaces
            t = this.normalizeSpaces(t);

            // Skip if matches summary or is already in resources
            if (summaryText && t === summaryText) continue;
            if (this.isResourceText(t, resourceLines)) continue;

            // Filter resource metadata (dates, "Fitxategia", etc.)
            if (this.isMetadataText(t)) continue;

            // Avoid very short or repeated texts
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
