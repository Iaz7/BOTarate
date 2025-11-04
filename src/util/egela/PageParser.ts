import { FileData, FileManager } from "./FileManager";
import { HtmlParserBase } from "./HtmlParserBase";

export { PageParser };

/**
 * Parser especializado para parsear páginas de ejercicios a Markdown
 * con soporte para detección y marcado de archivos adjuntos
 */
class PageParser extends HtmlParserBase {
    private lines: string[] = [];
    private files: FileData[] = [];
    private pageId: string;
    private baseUrl: string;

    constructor(pageId: string) {
        super();
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

        const markdown = this.cleanupLines(this.lines);
        
        return {
            markdown,
            files: this.files
        };
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
            console.warn('[PageParser] Error descargando imagen:', error);
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
                console.warn('[PageParser] Error descargando archivo del enlace:', error);
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
}
