import { FileData, FileManager } from "./FileManager";
import { HtmlParserBase } from "./HtmlParserBase";

export { PageParser };

/**
 * Specialized parser for parsing exercise pages to Markdown
 * with support for attachment detection and marking
 */
class PageParser extends HtmlParserBase {
    private lines: string[] = [];
    private files: FileData[] = [];
    private textFileCounter: number = 0;
    private readonly pageId: string;
    private readonly baseUrl: string;

    constructor(pageId: string) {
        super();
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
        this.textFileCounter = 0;

        await this.processNode(element);

        const markdown = this.cleanupLines(this.lines);

        return {
            markdown,
            files: this.files
        };
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
     * Processes an image, downloading it and adding a marker
     */
    private async processImage(node: any): Promise<void> {
        const src = node.getAttribute('src') || node.dataset?.src;
        if (!src) return;

        const absoluteUrl = FileManager.resolveUrl(src, this.baseUrl);
        if (!this.isEgelaUrl(absoluteUrl)) {
            console.warn('[PageParser] Se omitió la descarga de una imagen externa:', absoluteUrl);
            return;
        }
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
        if (FileManager.isRelevantFileUrl(absoluteUrl)) {
            await this.handleRelevantFileLink(absoluteUrl, text);
            return;
        }

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
     * Inserta un marcador para un archivo de texto, sin incrustar el contenido completo.
     * El contenido se almacena en cache para consulta posterior con getFilteredFileContent.
     */
    private embedTextFileMarker(fileData: FileData): void {
        // Generar identificador único para archivo de texto
        this.textFileCounter++;
        const fileId = `FILE${this.textFileCounter}`;
        fileData.id = fileId;

        // Guardar el archivo en cache para consulta posterior
        FileManager.cacheTextFile(this.pageId, fileData);

        // Insertar marcador descriptivo en lugar del contenido completo
        const extension = fileData.filename?.split('.').pop()?.toLowerCase() || 'txt';
        this.lines.push(`[${fileId}:TEXT:${fileData.filename}] (Archivo de texto ${extension.toUpperCase()}, usar getFilteredFileContent para obtener contenido filtrado)`);
    }

    /**
     * Intenta mapear la extensión del archivo a un lenguaje para el fence
     */
    private getCodeFenceLanguage(extension?: string): string | null {
        if (!extension) return null;

        const mapping: Record<string, string | null> = {
            sql: 'sql',
            txt: null,
            md: 'md',
            csv: 'csv',
            json: 'json',
            xml: 'xml',
            html: 'html',
            js: 'javascript',
            ts: 'typescript',
            jsx: 'jsx',
            tsx: 'tsx',
            py: 'python'
        };

        const lang = mapping[extension];
        if (!lang) {
            return null;
        }
        return lang;
    }

    /**
     * Maneja la descarga e inserción de enlaces que apuntan a archivos relevantes
     */
    private async handleRelevantFileLink(url: string, text: string): Promise<void> {
        if (!this.isEgelaUrl(url)) {
            this.appendExternalLink(text, url);
            return;
        }

        // El identificador para archivos de texto se genera en embedTextFileMarker
        const fileId = `FILE${this.files.length + 1}`;

        try {
            const fileData = await FileManager.fetchAndConvertFile(url, fileId);
            if (fileData.text) {
                // Para archivos de texto, insertar marcador en lugar de contenido completo
                if (text) {
                    this.lines.push(text);
                }
                this.embedTextFileMarker(fileData);
                return;
            }

            this.files.push(fileData);
            this.appendFileMarker(text, fileId);
        } catch (error) {
            console.warn('[PageParser] Error descargando archivo del enlace:', error);
            if (text) this.lines.push(text);
        }
    }

    /**
     * Añade un marcador de archivo en el contenido markdown
     */
    private appendFileMarker(text: string, fileId: string): void {
        if (text) {
            this.lines.push(`${text} [${fileId}]`);
            return;
        }
        this.lines.push(`[${fileId}]`);
    }

    /**
     * Procesa un contenedor que mezcla texto y enlaces, garantizando la descarga de los archivos
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
     * Comprueba si un nodo contiene enlaces en cualquier profundidad inmediata
     */
    private nodeContainsLink(node: any): boolean {
        if (typeof node?.querySelector !== 'function') {
            return false;
        }

        return Boolean(node.querySelector('a'));
    }

    /**
     * Procesa encabezados garantizando que los enlaces embebidos descarguen archivos
     */
    private async processHeading(node: any, prefix: string): Promise<void> {
        if (this.nodeContainsLink(node)) {
            await this.processContainerWithLinks(node, { emitPlainText: false });
        }

        this.lines.push(`\n${prefix} ${this.cleanText(node.textContent)}`);
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
     * Verifica si una URL pertenece al dominio de Egela
     */
    private isEgelaUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.hostname.endsWith('egela.ehu.eus');
        } catch (error) {
            console.warn('[PageParser] URL inválida detectada:', url, error);
            return false;
        }
    }
}
