/**
 * SRT (SubRip Subtitle) Parser
 * Parses SRT format files into structured data with timestamps
 */

export interface SRTEntry {
  index: number;
  startTime: number;    // seconds
  endTime: number;      // seconds
  text: string;
}

/**
 * Parse SRT time format (HH:MM:SS,mmm) to seconds
 */
function parseTime(timeStr: string): number {
  // Format: 00:00:05,000 or 00:00:05.000
  const normalized = timeStr.trim().replace(',', '.');
  const parts = normalized.split(':');

  if (parts.length !== 3) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseFloat(parts[2]);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert seconds to SRT time format (HH:MM:SS,mmm)
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Parse SRT content into structured entries
 */
export function parseSRT(content: string): SRTEntry[] {
  const entries: SRTEntry[] = [];

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into blocks (separated by blank lines)
  const blocks = normalized.split(/\n\n+/).filter(block => block.trim());

  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim());

    if (lines.length < 3) {
      continue; // Skip invalid blocks
    }

    // First line: index number
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) {
      continue; // Skip if index is not a number
    }

    // Second line: timestamp (start --> end)
    const timeMatch = lines[1].match(/^(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
    if (!timeMatch) {
      continue; // Skip if timestamp format is invalid
    }

    const startTime = parseTime(timeMatch[1]);
    const endTime = parseTime(timeMatch[2]);

    // Remaining lines: subtitle text
    const text = lines.slice(2).join('\n').trim();

    entries.push({
      index,
      startTime,
      endTime,
      text,
    });
  }

  // Sort by index to ensure correct order
  entries.sort((a, b) => a.index - b.index);

  return entries;
}

/**
 * Generate SRT content from entries
 */
export function generateSRT(entries: SRTEntry[]): string {
  return entries.map((entry, i) => {
    const index = i + 1;
    const start = formatTime(entry.startTime);
    const end = formatTime(entry.endTime);
    return `${index}\n${start} --> ${end}\n${entry.text}`;
  }).join('\n\n') + '\n';
}

/**
 * Validate SRT content
 */
export function validateSRT(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const entries = parseSRT(content);

    if (entries.length === 0) {
      errors.push('No valid subtitle entries found');
    }

    // Check for overlapping timestamps
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].startTime < entries[i - 1].endTime) {
        errors.push(`Entry ${entries[i].index} starts before entry ${entries[i - 1].index} ends`);
      }
    }

    // Check for empty text
    entries.forEach(entry => {
      if (!entry.text.trim()) {
        errors.push(`Entry ${entry.index} has empty text`);
      }
    });

  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Parse error');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get total duration from SRT entries
 */
export function getTotalDuration(entries: SRTEntry[]): number {
  if (entries.length === 0) return 0;
  return Math.max(...entries.map(e => e.endTime));
}
