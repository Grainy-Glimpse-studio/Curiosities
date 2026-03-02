/**
 * Simple local profanity filter
 * Checks text against a blocklist before saving
 */

// Common profanity words (English + Chinese + Pinyin)
// You can expand this list as needed
const BLOCKLIST: string[] = [
  // English
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'bastard', 'dick', 'cock', 'pussy',
  'asshole', 'bullshit', 'motherfucker', 'wtf', 'stfu', 'fck', 'fuk', 'sht',
  'nigger', 'nigga', 'faggot', 'retard', 'slut', 'whore', 'cunt',

  // Chinese profanity
  '傻逼', '操你', '草泥马', '妈的', '他妈', '靠北', '干你', '屌',
  '废物', '垃圾', '滚蛋', '去死', '白痴', '智障', '脑残', '贱',
  '婊子', '妓女', '鸡巴', '屁眼', '混蛋', '王八蛋', '狗日',
  'sb', 'nmsl', 'cnm', 'wcnm', 'rnm', 'mdzz',

  // Variations
  'f*ck', 'f**k', 's**t', 'b*tch', 'a**', 'a**hole',
];

// Normalize text for comparison (lowercase, remove spaces/special chars)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, '') // Keep only letters, numbers, Chinese chars
    .replace(/(.)\1{2,}/g, '$1$1'); // Reduce repeated chars (e.g., "fuuuck" -> "fuuck")
}

/**
 * Check if text contains profanity
 * @returns true if clean, false if contains bad words
 */
export function isClean(text: string): boolean {
  const normalized = normalize(text);

  for (const word of BLOCKLIST) {
    const normalizedWord = normalize(word);
    if (normalized.includes(normalizedWord)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the first bad word found (for debugging/logging)
 */
export function findBadWord(text: string): string | null {
  const normalized = normalize(text);

  for (const word of BLOCKLIST) {
    const normalizedWord = normalize(word);
    if (normalized.includes(normalizedWord)) {
      return word;
    }
  }

  return null;
}

/**
 * Replace bad words with asterisks
 */
export function censor(text: string): string {
  let result = text;

  for (const word of BLOCKLIST) {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  }

  return result;
}

/**
 * Validate message for submission
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateMessage(text: string): { valid: boolean; reason?: string } {
  // Check length
  if (!text || text.trim().length === 0) {
    return { valid: false, reason: 'Message cannot be empty' };
  }

  if (text.length > 200) {
    return { valid: false, reason: 'Message too long (max 200 characters)' };
  }

  if (text.length < 2) {
    return { valid: false, reason: 'Message too short (min 2 characters)' };
  }

  // Check profanity
  if (!isClean(text)) {
    return { valid: false, reason: 'Please keep it friendly' };
  }

  return { valid: true };
}
