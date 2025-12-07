export { HtmlParserBase };

/**
 * Base class with common utilities for HTML parsers
 */
abstract class HtmlParserBase {
    /**
     * Cleans text by removing extra spaces and HTML characters
     */
    protected cleanText(text: string): string {
        return text
            .replace(/\s+/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }

    /**
     * Normalizes spaces in a text
     */
    protected normalizeSpaces(text: string): string {
        return text.replace(/\s+/g, ' ');
    }

    /**
     * Cleans lines by removing consecutive empty lines
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
     * Parses an HTML table to Markdown format
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
     * Determines if a node should be skipped
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
