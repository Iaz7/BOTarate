export { HtmlParserBase };

/**
 * Clase base con utilidades comunes para parsers de HTML
 */
abstract class HtmlParserBase {
    /**
     * Limpia el texto eliminando espacios extra y caracteres HTML
     */
    protected cleanText(text: string): string {
        return text
            .replace(/\s+/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }

    /**
     * Normaliza espacios en un texto
     */
    protected normalizeSpaces(text: string): string {
        return text.replace(/\s+/g, ' ');
    }

    /**
     * Limpia líneas eliminando líneas vacías consecutivas
     */
    protected cleanupLines(lines: string[]): string {
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

        return filteredLines.join('\n').trim();
    }

    /**
     * Parsea una tabla HTML a formato Markdown
     */
    protected parseTable(table: any): string[] {
        const tableLines: string[] = [];
        const rows = Array.from(table.querySelectorAll('tr'));
        
        if (rows.length === 0) return tableLines;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as any;
            const cells = Array.from(row.querySelectorAll('td, th'));
            const cellTexts = cells.map((cell: any) => this.cleanText(cell.textContent || ''));
            
            tableLines.push('| ' + cellTexts.join(' | ') + ' |');
            
            if (i === 0) {
                tableLines.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |');
            }
        }
        
        return tableLines;
    }

    /**
     * Determina si un nodo debe ser ignorado
     */
    protected shouldSkipNode(node: any, tagName: string | undefined): boolean {
        return (
            tagName === 'script' ||
            tagName === 'style' ||
            tagName === 'noscript' ||
            node.classList?.contains('ally-actions') ||
            node.classList?.contains('ally-image-cover') ||
            node.getAttribute?.('aria-hidden') === 'true'
        );
    }
}
