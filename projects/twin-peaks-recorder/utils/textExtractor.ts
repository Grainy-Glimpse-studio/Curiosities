/**
 * Text Extractor Utility
 * Extracts text from various file formats: TXT, PDF, DOCX, MD
 */

export interface ExtractedText {
  text: string;
  wordCount: number;
  charCount: number;
  sourceFormat: 'txt' | 'md' | 'pdf' | 'docx';
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Strip markdown formatting from text
 * Removes: headers (#), bold/italic (*_), links, images, code blocks, etc.
 */
function stripMarkdown(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  // Split on whitespace and filter empty strings
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * Extract text from a TXT file
 */
async function extractFromTxt(file: File): Promise<ExtractedText> {
  const text = await file.text();
  return {
    text: text.trim(),
    wordCount: countWords(text),
    charCount: text.length,
    sourceFormat: 'txt',
  };
}

/**
 * Extract text from a Markdown file
 */
async function extractFromMarkdown(file: File): Promise<ExtractedText> {
  const rawText = await file.text();
  const text = stripMarkdown(rawText);
  return {
    text,
    wordCount: countWords(text),
    charCount: text.length,
    sourceFormat: 'md',
  };
}

/**
 * Extract text from a PDF file using pdf.js
 */
async function extractFromPdf(file: File): Promise<ExtractedText> {
  // Dynamic import to avoid bundling issues
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source - use CDN for simplicity
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(pageText);
  }

  const text = textParts.join('\n\n').trim();

  if (!text) {
    throw new Error('No text content found in PDF. This might be a scanned/image-based PDF.');
  }

  return {
    text,
    wordCount: countWords(text),
    charCount: text.length,
    sourceFormat: 'pdf',
  };
}

/**
 * Extract text from a DOCX file using mammoth
 */
async function extractFromDocx(file: File): Promise<ExtractedText> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();

  if (!text) {
    throw new Error('No text content found in DOCX file.');
  }

  return {
    text,
    wordCount: countWords(text),
    charCount: text.length,
    sourceFormat: 'docx',
  };
}

/**
 * Supported file extensions for text extraction
 */
export const SUPPORTED_TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'pdf', 'docx'];

/**
 * Check if a file is supported for text extraction
 */
export function isTextFileSupported(filename: string): boolean {
  const ext = getFileExtension(filename);
  return SUPPORTED_TEXT_EXTENSIONS.includes(ext);
}

/**
 * Get MIME types for file input accept attribute
 */
export const TEXT_FILE_ACCEPT = '.txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Extract text from a file
 * Automatically detects file type and uses appropriate extraction method
 */
export async function extractTextFromFile(file: File): Promise<ExtractedText> {
  const ext = getFileExtension(file.name);

  switch (ext) {
    case 'txt':
      return extractFromTxt(file);

    case 'md':
    case 'markdown':
      return extractFromMarkdown(file);

    case 'pdf':
      return extractFromPdf(file);

    case 'docx':
      return extractFromDocx(file);

    default:
      // Try to detect by MIME type
      if (file.type === 'text/plain') {
        return extractFromTxt(file);
      }
      if (file.type === 'text/markdown') {
        return extractFromMarkdown(file);
      }
      if (file.type === 'application/pdf') {
        return extractFromPdf(file);
      }
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return extractFromDocx(file);
      }

      throw new Error(`Unsupported file type: ${ext || file.type || 'unknown'}`);
  }
}
