/**
 * Audio Export Utilities
 * - Convert WebM/audio blob to WAV
 * - Create BWF (Broadcast Wave Format) with timecode metadata
 */

// WAV file header structure
interface WavHeader {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
}

/**
 * Convert audio blob (WebM, etc.) to WAV format
 */
export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  // Create audio context for decoding
  const audioContext = new AudioContext();

  // Read blob as array buffer
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Convert to WAV
  const wavBuffer = audioBufferToWav(audioBuffer);

  await audioContext.close();

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Convert audio blob to BWF (Broadcast Wave Format)
 * BWF is WAV with additional 'bext' chunk containing timecode info
 */
export async function convertToBwf(
  audioBlob: Blob,
  recordingStartTime: number // Unix timestamp in ms when recording started
): Promise<Blob> {
  // Create audio context for decoding
  const audioContext = new AudioContext();

  // Read blob as array buffer
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Convert to BWF
  const bwfBuffer = audioBufferToBwf(audioBuffer, recordingStartTime);

  await audioContext.close();

  return new Blob([bwfBuffer], { type: 'audio/wav' });
}

/**
 * Convert AudioBuffer to WAV ArrayBuffer
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;

  // Interleave channels
  const interleaved = interleaveChannels(buffer);
  const samples = new Int16Array(interleaved.length);

  // Convert float to 16-bit PCM
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset + i * 2, samples[i], true);
  }

  return arrayBuffer;
}

/**
 * Convert AudioBuffer to BWF ArrayBuffer
 * BWF adds a 'bext' chunk with broadcast metadata including TimeReference
 */
function audioBufferToBwf(buffer: AudioBuffer, recordingStartTime: number): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;

  // Interleave channels
  const interleaved = interleaveChannels(buffer);
  const samples = new Int16Array(interleaved.length);

  // Convert float to 16-bit PCM
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const dataSize = samples.length * bytesPerSample;

  // Calculate time reference (samples since midnight)
  const recordingDate = new Date(recordingStartTime);
  const midnightMs = new Date(recordingDate).setHours(0, 0, 0, 0);
  const msSinceMidnight = recordingStartTime - midnightMs;
  const samplesSinceMidnight = Math.floor((msSinceMidnight / 1000) * sampleRate);

  // BWF 'bext' chunk structure (602 bytes fixed size in v1)
  // Description: 256 bytes
  // Originator: 32 bytes
  // OriginatorReference: 32 bytes
  // OriginationDate: 10 bytes
  // OriginationTime: 8 bytes
  // TimeReferenceLow: 4 bytes
  // TimeReferenceHigh: 4 bytes
  // Version: 2 bytes
  // UMID: 64 bytes
  // LoudnessValue: 2 bytes
  // LoudnessRange: 2 bytes
  // MaxTruePeakLevel: 2 bytes
  // MaxMomentaryLoudness: 2 bytes
  // MaxShortTermLoudness: 2 bytes
  // Reserved: 180 bytes
  // Total: 602 bytes

  const bextSize = 602;
  const bextChunkSize = 8 + bextSize; // 'bext' + size (4) + data

  const headerSize = 44; // Standard WAV header
  const totalSize = headerSize + bextChunkSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // bext chunk (Broadcast Extension)
  let offset = 12;
  writeString(view, offset, 'bext');
  view.setUint32(offset + 4, bextSize, true);
  offset += 8;

  // Description (256 bytes) - Recording info
  const description = `Recorded with Diane - ${recordingDate.toISOString()}`;
  writeStringPadded(view, offset, description, 256);
  offset += 256;

  // Originator (32 bytes)
  writeStringPadded(view, offset, 'Diane Recorder', 32);
  offset += 32;

  // OriginatorReference (32 bytes)
  const reference = `DIANE${recordingStartTime.toString().slice(-8)}`;
  writeStringPadded(view, offset, reference, 32);
  offset += 32;

  // OriginationDate (10 bytes) - YYYY-MM-DD format
  const dateStr = recordingDate.toISOString().slice(0, 10);
  writeString(view, offset, dateStr);
  offset += 10;

  // OriginationTime (8 bytes) - HH:MM:SS format
  const timeStr = recordingDate.toTimeString().slice(0, 8);
  writeString(view, offset, timeStr);
  offset += 8;

  // TimeReference (8 bytes = Low 4 + High 4)
  // This is the key field for timecode sync!
  const timeRefLow = samplesSinceMidnight & 0xFFFFFFFF;
  const timeRefHigh = Math.floor(samplesSinceMidnight / 0x100000000);
  view.setUint32(offset, timeRefLow, true);
  view.setUint32(offset + 4, timeRefHigh, true);
  offset += 8;

  // Version (2 bytes) - BWF version 1
  view.setUint16(offset, 1, true);
  offset += 2;

  // UMID (64 bytes) - leave empty
  offset += 64;

  // Loudness fields (10 bytes) - leave as 0
  offset += 10;

  // Reserved (180 bytes) - leave empty
  offset += 180;

  // fmt chunk
  writeString(view, offset, 'fmt ');
  view.setUint32(offset + 4, 16, true);
  view.setUint16(offset + 8, 1, true); // PCM
  view.setUint16(offset + 10, numChannels, true);
  view.setUint32(offset + 12, sampleRate, true);
  view.setUint32(offset + 16, sampleRate * blockAlign, true);
  view.setUint16(offset + 20, blockAlign, true);
  view.setUint16(offset + 22, bitsPerSample, true);
  offset += 24;

  // data chunk
  writeString(view, offset, 'data');
  view.setUint32(offset + 4, dataSize, true);
  offset += 8;

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset + i * 2, samples[i], true);
  }

  return arrayBuffer;
}

/**
 * Interleave audio channels
 */
function interleaveChannels(buffer: AudioBuffer): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const result = new Float32Array(length * numChannels);

  if (numChannels === 1) {
    return buffer.getChannelData(0);
  }

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      result[i * numChannels + ch] = channels[ch][i];
    }
  }

  return result;
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Write string to DataView with padding (null-terminated, fixed size)
 */
function writeStringPadded(view: DataView, offset: number, str: string, size: number): void {
  const bytes = Math.min(str.length, size - 1);
  for (let i = 0; i < bytes; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
  // Pad with zeros
  for (let i = bytes; i < size; i++) {
    view.setUint8(offset + i, 0);
  }
}
