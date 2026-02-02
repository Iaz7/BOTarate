import { extractText } from "unpdf";

/**
 * Extracts text from a PDF in the content script context
 * (where window exists, required for pdf.js)
 */
export async function extractPdfTextFromBase64(
    pdfBase64: string,
    filename: string,
    resourceName: string,
    size: number
): Promise<{ success: true; text: string } | { success: false; error: string }> {
    try {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        // Extract text using unpdf
        const result = await extractText(arrayBuffer, { mergePages: false });

        const textParts: string[] = result.text.map((pageText: string, index: number) =>
            `--- Page ${index + 1} ---\n${pageText}`
        );

        const fullText = textParts.join('\n\n');
        const numPages = result.text.length;

        console.log(`[PdfExtractor] PDF converted to text: ${numPages} pages, ${fullText.length} characters`);

        const formattedText = `File: ${resourceName} (${filename})\nType: PDF\nPages: ${numPages}\nSize: ${(size / 1024).toFixed(2)} KB\n\nCONTENT:\n${fullText}`;

        return { success: true, text: formattedText };
    } catch (error) {
        console.error('[PdfExtractor] Error extracting PDF text:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
