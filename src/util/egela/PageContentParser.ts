import { FileManager, FileData } from "./FileManager";

export { PageContentParser };

/**
 * Clase responsable de parsear contenido HTML a Markdown
 * con soporte para detección y marcado de archivos adjuntos
 */
class PageContentParser {
    private lines: string[] = [];
    private files: FileData[] = [];
    private pageId: string;
    private baseUrl: string;

    constructor(pageId: string) {
        this.pageId = pageId;
        this.baseUrl = `https://egela.ehu.eus/mod/page/view.php?id=${pageId}`;
    }

    /**
     * Parsea un elemento HTML a formato Markdown con detección de archivos
     * @param element Elemento HTML a parsear
     * @returns Objeto con el markdown generado y los archivos detectados
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
     * Limpia el texto eliminando espacios extra y caracteres HTML
     */
    private cleanText(text: string): string {
        return text
            .replace(/\s+/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }

    /**
     * Parsea una tabla HTML a formato Markdown
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
     * Procesa un nodo HTML de forma recursiva
     */
    private async processNode(node: any): Promise<void> {
        const tagName = node.tagName?.toLowerCase();

        // Saltar elementos irrelevantes
        if (this.shouldSkipNode(node, tagName)) {
            return;
        }

        // Procesar según el tipo de elemento
        switch (tagName) {
            case 'h1':
                this.lines.push('\n# ' + this.cleanText(node.textContent));
                break;
            case 'h2':
                this.lines.push('\n## ' + this.cleanText(node.textContent));
                break;
            case 'h3':
                this.lines.push('\n### ' + this.cleanText(node.textContent));
                break;
            case 'h4':
                this.lines.push('\n#### ' + this.cleanText(node.textContent));
                break;
            case 'h5':
                this.lines.push('\n##### ' + this.cleanText(node.textContent));
                break;
            case 'h6':
                this.lines.push('\n###### ' + this.cleanText(node.textContent));
                break;
            case 'table':
                this.lines.push('\n');
                this.lines.push(...this.parseTable(node));
                this.lines.push('\n');
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

        // Verificar si es un archivo relevante
        if (FileManager.isRelevantFileUrl(absoluteUrl)) {
            const fileId = `FILE${this.files.length + 1}`;
            
            try {
                const fileData = await FileManager.fetchAndConvertFile(absoluteUrl, fileId);
                this.files.push(fileData);
                
                // Insertar marcador junto al texto del enlace
                if (text) {
                    this.lines.push(`${text} [${fileId}]`);
                } else {
                    this.lines.push(`[${fileId}]`);
                }
            } catch (error) {
                console.warn('[PageContentParser] Error descargando archivo del enlace:', error);
                if (text) this.lines.push(text);
            }
        } else {
            // No es un archivo relevante, procesar normalmente
            await this.processChildren(node);
            if (text) this.lines.push(text);
        }
    }

    /**
     * Procesa un nodo de texto (p, div, span)
     */
    private async processTextNode(node: any): Promise<void> {
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
