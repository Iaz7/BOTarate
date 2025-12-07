import { FileData, FileManager } from "./FileManager";

export { PageContentParser };

/**
 * Class responsible for parsing HTML content to Markdown
 * with support for attachment detection and marking
 */
class PageContentParser {
    private lines: string[] = [];
    private files: FileData[] = [];
    private readonly pageId: string;
    private readonly baseUrl: string;

    constructor(pageId: string) {
        this.pageId = pageId;
        this.baseUrl = `https://egela.ehu.eus/mod/page/view.php?id=${pageId}`;
    }

    /**
     * Parses an HTML element to Markdown format with file detection
     * @param element HTML element to parse
     * @returns Object with generated markdown and detected files
     */
    async parseToMarkdown(element: any): Promise<{ markdown: string; files: FileData[] }> {
        this.lines = [];
        this.files = [];

        await this.processNode(element);

        const markdown = this.cleanupMarkdown();

        return {
            markdown,
            files: this.files
        };
    }

    /**
     * Cleans text by removing extra spaces and HTML characters
     */
    private cleanText(text: string): string {
        return text
            .replaceAll(/\s+/g, ' ')
            .replaceAll('&nbsp;', ' ')
            .trim();
    }

    /**
     * Parses an HTML table to Markdown format
     */
    private parseTable(table: any): string[] {
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
     * Processes an HTML node recursively
     */
    private async processNode(node: any): Promise<void> {
        const tagName = node.tagName?.toLowerCase();

        // Skip irrelevant elements
        if (this.shouldSkipNode(node, tagName)) {
            return;
        }

        // Process according to element type
        switch (tagName) {
            case 'h1':
                await this.processHeading(node, '#');
                break;
            case 'h2':
                await this.processHeading(node, '##');
                break;
            case 'h3':
                await this.processHeading(node, '###');
                break;
            case 'h4':
                await this.processHeading(node, '####');
                break;
            case 'h5':
                await this.processHeading(node, '#####');
                break;
            case 'h6':
                await this.processHeading(node, '######');
                break;
            case 'table':
                this.lines.push('\n', ...this.parseTable(node), '\n');
                break;
            case 'img':
                await this.processImage(node);
                break;
            case 'a':
                await this.processLink(node);
                break;
            case 'p':
            case 'div':
            case 'span': {
                await this.processTextNode(node);
                break;
            }
            default:
                await this.processChildren(node);
                break;
        }
    }

    /**
     * Determina si un nodo debe ser ignorado
     */
    private shouldSkipNode(node: any, tagName: string | undefined): boolean {
        return (
            tagName === 'script' ||
            tagName === 'style' ||
            tagName === 'noscript' ||
            node.classList?.contains('ally-actions') ||
            node.classList?.contains('ally-image-cover') ||
            node.getAttribute?.('aria-hidden') === 'true'
        );
    }

    /**
     * Procesa una imagen, descargándola y añadiendo un marcador
     */
    private async processImage(node: any): Promise<void> {
        const src = node.getAttribute('src') || node.dataset?.src;
        if (!src) return;

        const absoluteUrl = FileManager.resolveUrl(src, this.baseUrl);
        if (!this.isEgelaUrl(absoluteUrl)) {
            console.warn('[PageContentParser] Se omitió la descarga de una imagen externa:', absoluteUrl);
            return;
        }
        const fileId = `FILE${this.files.length + 1}`;

        try {
            const fileData = await FileManager.fetchAndConvertFile(absoluteUrl, fileId);
            this.files.push(fileData);
            this.lines.push(`[${fileId}]`);
        } catch (error) {
            console.warn('[PageContentParser] Error descargando imagen:', error);
            this.lines.push(`[IMAGE MISSING]`);
        }
    }

    /**
     * Procesa un enlace, descargándolo si es relevante
     */
    private async processLink(node: any): Promise<void> {
        const href = node.getAttribute('href');
        const text = this.cleanText(node.textContent || '');

        if (!href) {
            await this.processChildren(node);
            if (text) this.lines.push(text);
            return;
        }

        const absoluteUrl = FileManager.resolveUrl(href, this.baseUrl);

        if (FileManager.isRelevantFileUrl(absoluteUrl)) {
            await this.handleRelevantFileLink(absoluteUrl, text);
            return;
        }

        // No es un archivo relevante, procesar normalmente
        await this.processChildren(node);
        if (text) this.lines.push(text);
    }

    /**
     * Procesa un nodo de texto (p, div, span)
     */
    private async processTextNode(node: any): Promise<void> {
        if (this.nodeContainsLink(node)) {
            await this.processContainerWithLinks(node);
            return;
        }

        const text = this.cleanText(node.textContent || '');

        // Evitar duplicados y contenido vacío
        if (text && text.length > 0 && !this.lines.includes(text)) {
            // Verificar si tiene hijos relevantes
            const hasRelevantChildren = Array.from(node.children || []).some(
                (child: any) => {
                    const childTag = child.tagName?.toLowerCase();
                    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'p'].includes(childTag);
                }
            );

            if (!hasRelevantChildren && text !== '&nbsp;') {
                this.lines.push(text);
            }
        }

        await this.processChildren(node);
    }

    /**
     * Procesa los hijos de un nodo
     */
    private async processChildren(node: any): Promise<void> {
        for (const child of Array.from(node.children || [])) {
            await this.processNode(child);
        }
    }

    /**
     * Descarga y marca archivos relevantes si pertenecen a Egela
     */
    private async handleRelevantFileLink(url: string, text: string): Promise<void> {
        if (!this.isEgelaUrl(url)) {
            this.appendExternalLink(text, url);
            return;
        }

        const fileId = `FILE${this.files.length + 1}`;

        try {
            const fileData = await FileManager.fetchAndConvertFile(url, fileId);
            this.files.push(fileData);
            this.appendFileMarker(text, fileId);
        } catch (error) {
            console.warn('[PageContentParser] Error descargando archivo del enlace:', error);
            if (text) this.lines.push(text);
        }
    }

    /**
     * Inserta enlaces externos sin intentar descargarlos
     */
    private appendExternalLink(text: string, url: string): void {
        if (text) {
            this.lines.push(`${text} (${url})`);
            return;
        }
        this.lines.push(url);
    }

    /**
     * Inserta el marcador de archivo manteniendo el texto original si existe
     */
    private appendFileMarker(text: string, fileId: string): void {
        if (text) {
            this.lines.push(`${text} [${fileId}]`);
            return;
        }
        this.lines.push(`[${fileId}]`);
    }

    /**
     * Procesa un contenedor con enlaces embebidos asegurando que se descarguen
     */
    private async processContainerWithLinks(node: any, options: { emitPlainText?: boolean } = {}): Promise<void> {
        const emitPlainText = options.emitPlainText !== false;
        for (const child of Array.from(node.childNodes || [])) {
            const childNode = child as any;
            const tagName = childNode.tagName?.toLowerCase();
            if (tagName === 'a') {
                await this.processLink(childNode);
                continue;
            }
            if (tagName) {
                await this.processNode(childNode);
                continue;
            }

            if (!emitPlainText) {
                continue;
            }

            const text = this.cleanText(childNode.textContent || '');
            if (text) {
                this.lines.push(text);
            }
        }
    }

    /**
     * Detecta si el nodo contiene enlaces en cualquier profundidad inmediata
     */
    private nodeContainsLink(node: any): boolean {
        if (typeof node?.querySelector !== 'function') {
            return false;
        }

        return Boolean(node.querySelector('a'));
    }

    /**
     * Procesa encabezados asegurando que los enlaces embebidos descarguen archivos
     */
    private async processHeading(node: any, prefix: string): Promise<void> {
        if (this.nodeContainsLink(node)) {
            await this.processContainerWithLinks(node, { emitPlainText: false });
        }

        this.lines.push(`\n${prefix} ${this.cleanText(node.textContent)}`);
    }

    /**
     * Verifica si una URL pertenece al dominio de Egela
     */
    private isEgelaUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.hostname.endsWith('egela.ehu.eus');
        } catch (error) {
            console.warn('[PageContentParser] URL inválida detectada:', url, error);
            return false;
        }
    }

    /**
     * Limpia el markdown eliminando líneas vacías consecutivas
     */
    private cleanupMarkdown(): string {
        const filteredLines: string[] = [];
        let lastWasEmpty = false;

        for (const line of this.lines) {
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
}
