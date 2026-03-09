/**
 * TTS Service
 * Handles text-to-speech generation using ElevenLabs or Fish Audio
 */

import { SRTEntry, parseSRT, getTotalDuration } from '../utils/srtParser';
import { mergeAudioWithTimestamps, MergedAudioResult, createBwfBlob } from '../utils/audioMerge';
import { TTSVoice } from './auth';

export interface ElevenLabsVoiceSettings {
  speed?: number;           // 0.5-2.0, default 1.0
  stability?: number;       // 0-1, default 0.5
  similarity_boost?: number; // 0-1, default 0.75
  style?: number;           // 0-1, default 0
  use_speaker_boost?: boolean; // default false
}

export interface TTSConfig {
  provider: 'elevenlabs' | 'fish_audio';
  apiKey: string;
  voiceId: string;
  voiceLabel?: string;
  // ElevenLabs specific settings
  voiceSettings?: ElevenLabsVoiceSettings;
  languageCode?: string;    // e.g., "en", "zh", "ja"
}

export interface TTSProgress {
  current: number;      // Current entry being processed
  total: number;        // Total entries
  percentage: number;   // 0-100
  status: string;       // Status message
}

export interface TTSResult {
  audioBlob: Blob;
  duration: number;
  format: 'mp3' | 'wav';
  entriesProcessed: number;
}

/**
 * Generate TTS audio for a single text segment
 */
async function generateSingleTTS(
  text: string,
  config: TTSConfig
): Promise<Blob> {
  // Build request body
  const requestBody: Record<string, unknown> = {
    provider: config.provider,
    apiKey: config.apiKey,
    voiceId: config.voiceId,
    text,
  };

  // Add ElevenLabs-specific settings
  if (config.provider === 'elevenlabs' && config.voiceSettings) {
    const { speed, stability, similarity_boost, style, use_speaker_boost } = config.voiceSettings;
    if (speed !== undefined) requestBody.speed = speed;
    if (stability !== undefined) requestBody.stability = stability;
    if (similarity_boost !== undefined) requestBody.similarity_boost = similarity_boost;
    if (style !== undefined) requestBody.style = style;
    if (use_speaker_boost !== undefined) requestBody.use_speaker_boost = use_speaker_boost;
  }

  // Add language code if specified
  if (config.languageCode && config.languageCode !== 'auto') {
    requestBody.language_code = config.languageCode;
  }

  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `TTS request failed: ${response.status}`);
  }

  return response.blob();
}

/**
 * Generate TTS audio from SRT content
 * Each subtitle entry is converted to speech, then merged with proper timing
 */
export async function generateTTSFromSRT(
  srtContent: string,
  config: TTSConfig,
  onProgress?: (progress: TTSProgress) => void
): Promise<TTSResult> {
  // Parse SRT
  const entries = parseSRT(srtContent);

  if (entries.length === 0) {
    throw new Error('No valid subtitle entries found in SRT file');
  }

  onProgress?.({
    current: 0,
    total: entries.length,
    percentage: 0,
    status: 'Starting TTS generation...',
  });

  // Generate TTS for each entry
  const segments: Array<{ entry: SRTEntry; audioBlob: Blob }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    onProgress?.({
      current: i + 1,
      total: entries.length,
      percentage: Math.round(((i + 1) / entries.length) * 80), // 80% for TTS generation
      status: `Generating speech for entry ${i + 1}/${entries.length}...`,
    });

    try {
      const audioBlob = await generateSingleTTS(entry.text, config);
      segments.push({ entry, audioBlob });
    } catch (error) {
      console.error(`Failed to generate TTS for entry ${i + 1}:`, error);
      throw new Error(`Failed to generate speech for entry ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Small delay between requests to avoid rate limiting
    if (i < entries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  onProgress?.({
    current: entries.length,
    total: entries.length,
    percentage: 85,
    status: 'Merging audio segments...',
  });

  // Merge audio segments with proper timing
  const mergedResult = await mergeAudioWithTimestamps(segments, (p) => {
    onProgress?.({
      current: entries.length,
      total: entries.length,
      percentage: 85 + Math.round(p * 0.15), // 85-100% for merging
      status: 'Merging audio segments...',
    });
  });

  onProgress?.({
    current: entries.length,
    total: entries.length,
    percentage: 100,
    status: 'Complete!',
  });

  return {
    audioBlob: mergedResult.blob,
    duration: mergedResult.duration,
    format: mergedResult.format,
    entriesProcessed: entries.length,
  };
}

/**
 * Generate TTS audio from plain text (for FloatingTranscript Export)
 * Splits text into reasonable chunks if too long
 */
export async function generateTTSFromText(
  text: string,
  config: TTSConfig,
  onProgress?: (progress: TTSProgress) => void
): Promise<TTSResult> {
  // Split text into chunks of roughly 1000 characters at sentence boundaries
  const chunks = splitTextIntoChunks(text, 1000);

  if (chunks.length === 0) {
    throw new Error('No text to convert');
  }

  onProgress?.({
    current: 0,
    total: chunks.length,
    percentage: 0,
    status: 'Starting TTS generation...',
  });

  const audioBlobs: Blob[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.({
      current: i + 1,
      total: chunks.length,
      percentage: Math.round(((i + 1) / chunks.length) * 100),
      status: `Generating speech ${i + 1}/${chunks.length}...`,
    });

    try {
      const audioBlob = await generateSingleTTS(chunks[i], config);
      audioBlobs.push(audioBlob);
    } catch (error) {
      console.error(`Failed to generate TTS for chunk ${i + 1}:`, error);
      throw new Error(`Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Small delay between requests
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // If only one chunk, return directly
  if (audioBlobs.length === 1) {
    return {
      audioBlob: audioBlobs[0],
      duration: 0, // Unknown without decoding
      format: 'mp3',
      entriesProcessed: 1,
    };
  }

  // Concatenate multiple audio blobs
  const concatenated = await concatenateAudioBlobs(audioBlobs);

  return {
    audioBlob: concatenated,
    duration: 0, // Unknown without decoding
    format: 'mp3',
    entriesProcessed: chunks.length,
  };
}

/**
 * Split text into chunks at sentence boundaries
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?。！？])\s*/);

  let currentChunk = '';

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;

    if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    currentChunk += sentence + ' ';
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Concatenate multiple audio blobs into one
 */
async function concatenateAudioBlobs(blobs: Blob[]): Promise<Blob> {
  // Simple concatenation for now - works for MP3 files
  // For proper audio concatenation, would need to decode and re-encode
  return new Blob(blobs, { type: blobs[0].type });
}

/**
 * Export TTS result as BWF (Broadcast Wave Format)
 * @param result - TTS result
 * @param startTimeSeconds - Start time in seconds from midnight for TimeReference
 */
export async function exportAsBwf(
  result: TTSResult,
  startTimeSeconds: number
): Promise<Blob> {
  // Convert result to WAV if not already
  let wavArrayBuffer: ArrayBuffer;

  if (result.format === 'wav') {
    wavArrayBuffer = await result.audioBlob.arrayBuffer();
  } else {
    // Need to decode and re-encode as WAV
    const audioContext = new AudioContext();
    try {
      const audioBuffer = await audioContext.decodeAudioData(await result.audioBlob.arrayBuffer());

      // Create WAV from AudioBuffer (simplified - mono, 16-bit)
      const wavBlob = audioBufferToWav(audioBuffer);
      wavArrayBuffer = await wavBlob.arrayBuffer();
    } finally {
      await audioContext.close();
    }
  }

  // Calculate TimeReference in samples (assuming 44.1kHz)
  const sampleRate = 44100;
  const timeReferenceSamples = Math.round(startTimeSeconds * sampleRate);

  return createBwfBlob(wavArrayBuffer, timeReferenceSamples);
}

/**
 * Convert AudioBuffer to WAV blob (copied from audioMerge for independence)
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const int16 = Math.max(-1, Math.min(1, sample)) * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
