/**
 * Audio Merge Utility
 * Merges multiple audio segments with proper silence gaps based on timestamps
 */

import { SRTEntry } from './srtParser';

/**
 * Result of generating audio from SRT
 */
export interface MergedAudioResult {
  blob: Blob;
  duration: number;
  format: 'mp3' | 'wav';
}

/**
 * Create a silent audio buffer of specified duration
 */
async function createSilence(audioContext: AudioContext, duration: number): Promise<AudioBuffer> {
  const sampleRate = audioContext.sampleRate;
  const numSamples = Math.ceil(duration * sampleRate);
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  // Buffer is already filled with zeros (silence)
  return buffer;
}

/**
 * Decode audio blob to AudioBuffer
 */
async function decodeAudio(audioContext: AudioContext, blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Get the actual duration of an audio blob
 */
export async function getAudioDuration(blob: Blob): Promise<number> {
  const audioContext = new AudioContext();
  try {
    const buffer = await decodeAudio(audioContext, blob);
    return buffer.duration;
  } finally {
    await audioContext.close();
  }
}

/**
 * Merge audio segments with silence gaps based on SRT timestamps
 *
 * @param segments - Array of { entry: SRTEntry, audioBlob: Blob }
 * @returns Merged audio as WAV blob
 */
export async function mergeAudioWithTimestamps(
  segments: Array<{ entry: SRTEntry; audioBlob: Blob }>,
  onProgress?: (progress: number) => void
): Promise<MergedAudioResult> {
  if (segments.length === 0) {
    throw new Error('No segments to merge');
  }

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.entry.startTime - b.entry.startTime);

  // Calculate total duration (last entry's end time)
  const totalDuration = Math.max(...sorted.map(s => s.entry.endTime));

  const audioContext = new AudioContext();

  try {
    const sampleRate = audioContext.sampleRate;
    const totalSamples = Math.ceil(totalDuration * sampleRate);

    // Create output buffer (mono for simplicity)
    const outputBuffer = audioContext.createBuffer(1, totalSamples, sampleRate);
    const outputData = outputBuffer.getChannelData(0);

    // Process each segment
    for (let i = 0; i < sorted.length; i++) {
      const { entry, audioBlob } = sorted[i];

      // Report progress
      onProgress?.(((i + 1) / sorted.length) * 100);

      // Decode audio
      const audioBuffer = await decodeAudio(audioContext, audioBlob);

      // Get the channel data (use first channel if stereo)
      const sourceData = audioBuffer.getChannelData(0);

      // Calculate start sample position based on SRT timestamp
      const startSample = Math.floor(entry.startTime * sampleRate);

      // Copy samples to output buffer
      // Limit to the planned duration to avoid overflow
      const plannedDuration = entry.endTime - entry.startTime;
      const plannedSamples = Math.ceil(plannedDuration * sampleRate);
      const samplesToUse = Math.min(sourceData.length, plannedSamples);

      for (let j = 0; j < samplesToUse; j++) {
        const outputIndex = startSample + j;
        if (outputIndex < totalSamples) {
          outputData[outputIndex] = sourceData[j];
        }
      }
    }

    // Convert AudioBuffer to WAV Blob
    const wavBlob = audioBufferToWav(outputBuffer);

    return {
      blob: wavBlob,
      duration: totalDuration,
      format: 'wav',
    };
  } finally {
    await audioContext.close();
  }
}

/**
 * Convert AudioBuffer to WAV Blob
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

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write interleaved samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      // Convert float [-1, 1] to int16
      const int16 = Math.max(-1, Math.min(1, sample)) * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert WAV blob to MP3 blob (using browser encoding if available)
 * Note: This is a simplified version - for full MP3 support, consider using lamejs
 */
export async function convertToMp3(wavBlob: Blob): Promise<Blob> {
  // For now, return the WAV blob as-is
  // Full MP3 encoding would require a library like lamejs
  console.warn('MP3 conversion not fully implemented, returning WAV');
  return wavBlob;
}

/**
 * Create BWF (Broadcast Wave Format) from WAV blob
 * Adds bext chunk with TimeReference
 */
export function createBwfBlob(wavBlob: ArrayBuffer, timeReferenceSamples: number): Blob {
  // Read existing WAV
  const view = new DataView(wavBlob);

  // Verify RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') {
    throw new Error('Not a valid WAV file');
  }

  // Create bext chunk (minimum fields)
  const bextSize = 602; // Fixed size for bext chunk
  const bextData = new ArrayBuffer(8 + bextSize);
  const bextView = new DataView(bextData);

  // bext chunk header
  writeString(bextView, 0, 'bext');
  bextView.setUint32(4, bextSize, true);

  // Description (256 bytes) - leave empty
  // Originator (32 bytes) - leave empty
  // OriginatorReference (32 bytes) - leave empty
  // OriginationDate (10 bytes) - leave empty
  // OriginationTime (8 bytes) - leave empty
  // TimeReference (8 bytes, little-endian uint64 at offset 8 + 256 + 32 + 32 + 10 + 8 = 346)
  const timeRefOffset = 8 + 256 + 32 + 32 + 10 + 8;
  bextView.setUint32(timeRefOffset, timeReferenceSamples & 0xFFFFFFFF, true);
  bextView.setUint32(timeRefOffset + 4, Math.floor(timeReferenceSamples / 0x100000000), true);

  // Create new file: RIFF header + bext chunk + original data (minus RIFF header)
  const originalDataStart = 12; // After "RIFF" + size + "WAVE"
  const originalData = wavBlob.slice(originalDataStart);

  // Update total size
  const newTotalSize = 4 + (8 + bextSize) + originalData.byteLength; // "WAVE" + bext + original chunks

  const newFile = new ArrayBuffer(8 + newTotalSize);
  const newView = new DataView(newFile);

  // Write RIFF header
  writeString(newView, 0, 'RIFF');
  newView.setUint32(4, newTotalSize, true);
  writeString(newView, 8, 'WAVE');

  // Copy bext chunk
  const bextBytes = new Uint8Array(bextData);
  const newBytes = new Uint8Array(newFile);
  newBytes.set(bextBytes, 12);

  // Copy original data (fmt and data chunks)
  const originalBytes = new Uint8Array(originalData);
  newBytes.set(originalBytes, 12 + 8 + bextSize);

  return new Blob([newFile], { type: 'audio/wav' });
}
