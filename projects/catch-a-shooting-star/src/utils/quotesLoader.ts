/**
 * Quotes Loader
 *
 * Parses markdown files from docs/quotes/ and returns ContentItems
 * with primary/secondary language support based on browser language.
 */

import type { ContentItem } from '../types';
import {
  simplifiedToTraditional,
  isPrimarilyChinese,
  isPrimarilyJapanese,
  isClassicalPoetry,
  splitByPunctuation,
} from './chineseConverter';

// Layout types for vertical text
export type VerticalLayoutType = 'none' | 'poetry' | 'prose-staggered' | 'prose-mixed';

// Extended content item with layout info
export interface ExtendedContentItem extends ContentItem {
  _verticalLayout?: VerticalLayoutType;
  _segments?: string[];  // Text split by punctuation for vertical display
  _translationSegments?: string[];
  _translationMeta?: string;
}

// Quote with translations
export interface Quote {
  id: string;
  primaryLang: string;           // 'en', 'zh', 'fr', 'ja'
  primaryText: string;           // Original quote text
  primaryMeta: QuoteMeta;        // Author / Work / Year / Location
  translations: Translation[];   // Secondary language translations
}

export interface QuoteMeta {
  author?: string;
  work?: string;
  year?: string;
  location?: string;
  translator?: string;           // For translations
}

export interface Translation {
  lang: string;                  // 'en', 'zh'
  text: string;
  meta: QuoteMeta;
}

// Parsed quote for display
export interface DisplayQuote {
  primary: {
    text: string;
    meta: QuoteMeta;
    lang: string;
  };
  secondary: {
    text: string;
    meta: QuoteMeta;
    lang: string;
  } | null;
}

/**
 * Get user's preferred language from browser
 * Returns 'zh' for Chinese, 'en' for everything else
 */
export function getUserLanguage(): 'zh' | 'en' {
  const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
  const lang = browserLang.toLowerCase();

  // Check for Chinese variants
  if (lang.startsWith('zh')) {
    return 'zh';
  }

  // Default to English for all other languages
  return 'en';
}

/**
 * Parse a single quote block from markdown
 */
function parseQuoteBlock(block: string): { text: string; meta: QuoteMeta } | null {
  const lines = block.trim().split('\n').filter(line => line.trim());

  if (lines.length === 0) return null;

  // Helper to check for opening/closing quotes (both straight and curly)
  const startsWithQuote = (s: string) => s.startsWith('"') || s.startsWith('"') || s.startsWith('「');
  const endsWithQuote = (s: string) => s.endsWith('"') || s.endsWith('"') || s.endsWith('」');
  const removeQuotes = (s: string) => {
    // Remove opening quote
    if (s.startsWith('"') || s.startsWith('"') || s.startsWith('「')) {
      s = s.slice(1);
    }
    // Remove closing quote
    if (s.endsWith('"') || s.endsWith('"') || s.endsWith('」')) {
      s = s.slice(0, -1);
    }
    return s;
  };

  // First line(s) should be the quote in double quotes
  let text = '';
  let metaLine = '';

  // Find the quote text (in double quotes) and metadata line
  let inQuote = false;
  let quoteLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (startsWithQuote(line) && !inQuote) {
      inQuote = true;
      quoteLines.push(line);
      if (endsWithQuote(line) && line.length > 1) {
        inQuote = false;
      }
    } else if (inQuote) {
      quoteLines.push(line);
      if (endsWithQuote(line)) {
        inQuote = false;
      }
    } else if (!inQuote && quoteLines.length > 0) {
      // This should be the metadata line
      metaLine = line;
      break;
    }
  }

  if (quoteLines.length === 0) return null;

  // Join quote lines and remove surrounding quotes
  text = quoteLines.join('\n');
  text = removeQuotes(text);
  text = text.trim();

  // Debug: log parsing result
  console.log(`   parseQuoteBlock: text="${text.slice(0, 30)}...", metaLine="${metaLine}"`);

  // Parse metadata: Author / Work / Year / Location
  // or: Translator 译 / Work / Year / Location
  const meta: QuoteMeta = {};

  if (metaLine) {
    const parts = metaLine.split('/').map(p => p.trim());

    // Check if it's a translation (contains 译)
    if (parts[0] && parts[0].includes('译')) {
      meta.translator = parts[0].replace('译', '').trim();
      if (parts[1]) meta.work = parts[1];
      if (parts[2]) meta.year = parts[2];
      if (parts[3]) meta.location = parts[3];
    } else {
      if (parts[0]) meta.author = parts[0];
      if (parts[1]) meta.work = parts[1];
      if (parts[2]) meta.year = parts[2];
      if (parts[3]) meta.location = parts[3];
    }
  }

  return { text, meta };
}

/**
 * Parse a markdown file content into quotes
 */
export function parseQuotesMarkdown(content: string, primaryLang: string): Quote[] {
  const quotes: Quote[] = [];

  // Split by --- separator
  const sections = content.split(/^---$/m).filter(s => s.trim());

  // Skip the header section (first one with "Primary language:")
  let startIndex = 0;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].includes('Primary language:')) {
      startIndex = i + 1;
      break;
    }
  }

  // Process quote sections (each section contains primary + translations)
  for (let i = startIndex; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    // Split section into blocks (separated by empty lines)
    const rawBlocks = section.split(/\n\n+/).filter(b => b.trim());
    console.log('📄 Section', i, 'rawBlocks count:', rawBlocks.length);
    rawBlocks.forEach((b, idx) => console.log(`  block ${idx}:`, b.slice(0, 50)));

    if (rawBlocks.length === 0) continue;

    // Merge quote blocks with their metadata blocks
    // A metadata block doesn't start with a quote character
    const startsWithQuote = (s: string) => {
      const trimmed = s.trim();
      return trimmed.startsWith('"') || trimmed.startsWith('"') || trimmed.startsWith('「');
    };

    const mergedBlocks: string[] = [];
    for (let j = 0; j < rawBlocks.length; j++) {
      const block = rawBlocks[j];
      if (startsWithQuote(block)) {
        // This is a quote block, check if next block is metadata
        if (j + 1 < rawBlocks.length && !startsWithQuote(rawBlocks[j + 1])) {
          // Merge quote with its metadata
          mergedBlocks.push(block + '\n\n' + rawBlocks[j + 1]);
          j++; // Skip the metadata block
        } else {
          mergedBlocks.push(block);
        }
      } else {
        // Standalone metadata (shouldn't happen, but handle it)
        mergedBlocks.push(block);
      }
    }

    console.log('📦 mergedBlocks count:', mergedBlocks.length);
    mergedBlocks.forEach((b, idx) => console.log(`  merged ${idx}:`, b.slice(0, 80)));

    if (mergedBlocks.length === 0) continue;

    // First merged block is primary quote
    const primary = parseQuoteBlock(mergedBlocks[0]);
    if (!primary) continue;

    const quote: Quote = {
      id: `quote-${primaryLang}-${i}`,
      primaryLang,
      primaryText: primary.text,
      primaryMeta: primary.meta,
      translations: [],
    };

    // Remaining merged blocks are translations
    for (let j = 1; j < mergedBlocks.length; j++) {
      const translation = parseQuoteBlock(mergedBlocks[j]);
      if (translation) {
        // Detect language from text content
        const lang = detectLanguage(translation.text);
        quote.translations.push({
          lang,
          text: translation.text,
          meta: translation.meta,
        });
      }
    }

    quotes.push(quote);
  }

  return quotes;
}

/**
 * Simple language detection based on character content
 */
function detectLanguage(text: string): string {
  // Count Chinese characters
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalChars = text.length;

  if (chineseChars / totalChars > 0.3) {
    return 'zh';
  }

  // Check for Japanese (hiragana/katakana)
  const japaneseChars = (text.match(/[\u3040-\u30ff]/g) || []).length;
  if (japaneseChars / totalChars > 0.1) {
    return 'ja';
  }

  return 'en';
}

/**
 * Format metadata for display
 * Returns: "Author / Work / Year / Location" format
 *
 * @param meta - The metadata object
 * @param isTranslation - If true, skip translator field (translation metadata uses original author)
 */
export function formatMeta(meta: QuoteMeta, isTranslation: boolean = false): string {
  const parts: string[] = [];

  // For translations, skip translator - we'll use original author instead
  if (!isTranslation) {
    if (meta.translator) {
      parts.push(`${meta.translator} 译`);
    } else if (meta.author) {
      parts.push(meta.author);
    }
  } else {
    // For translations, only include author if it's not a translator
    if (meta.author && !meta.translator) {
      parts.push(meta.author);
    }
  }

  if (meta.work) parts.push(meta.work);
  if (meta.year) parts.push(meta.year);
  if (meta.location) parts.push(meta.location);

  return parts.join(' / ');
}

/**
 * Convert Quote to DisplayQuote based on user's language preference
 */
export function toDisplayQuote(quote: Quote, userLang: 'zh' | 'en'): DisplayQuote {
  // Find appropriate translation
  let secondary: Translation | null = null;

  console.log('🔍 toDisplayQuote:', {
    primaryLang: quote.primaryLang,
    userLang,
    translationsCount: quote.translations.length,
    translationLangs: quote.translations.map(t => t.lang),
  });

  // If primary is already in user's language, no translation needed
  if (quote.primaryLang === userLang) {
    // Same language - no translation, Tab will just change font
    secondary = null;
  } else {
    // Find translation in user's preferred language
    secondary = quote.translations.find(t => t.lang === userLang) || null;

    // Fallback to English if user's language not found
    if (!secondary && userLang !== 'en') {
      secondary = quote.translations.find(t => t.lang === 'en') || null;
    }

    // Last resort: use first available translation
    if (!secondary && quote.translations.length > 0) {
      secondary = quote.translations[0];
    }
  }

  console.log('🔍 Selected secondary:', secondary ? secondary.lang : 'none');

  return {
    primary: {
      text: quote.primaryText,
      meta: quote.primaryMeta,
      lang: quote.primaryLang,
    },
    secondary: secondary ? {
      text: secondary.text,
      meta: secondary.meta,
      lang: secondary.lang,
    } : null,
  };
}

/**
 * Determine vertical layout type for text
 */
function getVerticalLayoutType(text: string, lang: string): VerticalLayoutType {
  // Only Chinese and Japanese use vertical layout
  if (!isPrimarilyChinese(text) && !isPrimarilyJapanese(text)) {
    return 'none';
  }

  // Check if it's classical poetry
  if (isClassicalPoetry(text)) {
    return 'poetry';
  }

  // For prose, randomly choose between staggered and mixed
  return Math.random() > 0.5 ? 'prose-staggered' : 'prose-mixed';
}

/**
 * Process text: convert simplified to traditional if Chinese
 */
function processText(text: string): string {
  if (isPrimarilyChinese(text)) {
    return simplifiedToTraditional(text);
  }
  return text;
}

/**
 * Convert DisplayQuote to ContentItem for StarCatcher
 */
export function quoteToContentItem(quote: DisplayQuote, id: string | number): ExtendedContentItem {
  // Process primary text (convert to traditional if Chinese)
  const primaryText = processText(quote.primary.text);
  const primaryLang = quote.primary.lang;

  // Determine layout type
  const verticalLayout = getVerticalLayoutType(primaryText, primaryLang);

  // Debug: log layout detection
  const metaStr = formatMeta(quote.primary.meta);
  console.log(`📝 Quote ${id}: lang=${primaryLang}, layout=${verticalLayout}`);
  console.log(`   meta object:`, quote.primary.meta);
  console.log(`   formatted: "${metaStr}"`);
  console.log(`   has translation:`, !!quote.secondary, quote.secondary?.text?.slice(0, 50));

  // Split text into segments for vertical display
  const segments = (verticalLayout !== 'none')
    ? splitByPunctuation(primaryText)
    : undefined;

  // Process secondary text (translation)
  let translationText: string | undefined;
  let translationSegments: string[] | undefined;
  let translationMeta: string | undefined;

  if (quote.secondary) {
    translationText = processText(quote.secondary.text);

    // Build translation metadata: use original author + translation's work/year/location
    // Format: "Original Author / Translated Work / Year"
    const originalAuthor = quote.primary.meta.author;
    const translationMetaParts: string[] = [];

    if (originalAuthor) {
      translationMetaParts.push(originalAuthor);
    }

    // Add work, year, location from translation metadata (skip translator)
    const secMeta = quote.secondary.meta;
    if (secMeta.work) translationMetaParts.push(secMeta.work);
    if (secMeta.year) translationMetaParts.push(secMeta.year);
    if (secMeta.location) translationMetaParts.push(secMeta.location);

    translationMeta = translationMetaParts.join(' / ');

    // If translation is Chinese/Japanese, also split into segments
    if (isPrimarilyChinese(translationText) || isPrimarilyJapanese(translationText)) {
      translationSegments = splitByPunctuation(translationText);
    }
  }

  return {
    id,
    type: 'text',
    content: primaryText,
    title: formatMeta(quote.primary.meta),
    // Translation info
    _translation: translationText,
    _translationMeta: translationMeta,
    // Vertical layout info
    _verticalLayout: verticalLayout,
    _segments: segments,
    _translationSegments: translationSegments,
  };
}

/**
 * Load all quotes from markdown files
 */
export async function loadAllQuotes(): Promise<Quote[]> {
  const allQuotes: Quote[] = [];

  // Load each language file
  const files = [
    { path: '/docs/quotes/en.md', lang: 'en' },
    { path: '/docs/quotes/zh.md', lang: 'zh' },
    { path: '/docs/quotes/fr.md', lang: 'fr' },
    { path: '/docs/quotes/ja.md', lang: 'ja' },
  ];

  console.log('📚 Loading quotes from markdown files...');

  for (const file of files) {
    try {
      const response = await fetch(file.path);
      console.log(`  ${file.lang}: ${response.status} ${response.ok ? '✓' : '✗'}`);
      if (response.ok) {
        const content = await response.text();
        const quotes = parseQuotesMarkdown(content, file.lang);
        console.log(`  ${file.lang}: parsed ${quotes.length} quotes`);
        allQuotes.push(...quotes);
      }
    } catch (error) {
      console.warn(`Failed to load quotes from ${file.path}:`, error);
    }
  }

  console.log(`📚 Total quotes loaded: ${allQuotes.length}`);
  return allQuotes;
}

/**
 * Load and prepare quotes as ContentItems
 */
export async function loadQuotesAsContent(): Promise<ExtendedContentItem[]> {
  const quotes = await loadAllQuotes();
  const userLang = getUserLanguage();
  console.log('🚀 loadQuotesAsContent called, userLang:', userLang, 'quotes:', quotes.length);

  return quotes.map((quote, index) => {
    const displayQuote = toDisplayQuote(quote, userLang);
    const contentItem = quoteToContentItem(displayQuote, `quote-${index}`);
    console.log('📦 ContentItem created:', {
      id: contentItem.id,
      hasTranslation: !!contentItem._translation,
      translationPreview: contentItem._translation?.slice(0, 50),
    });
    return contentItem;
  });
}
