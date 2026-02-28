export interface Memo {
  id: string;
  audioUrl: string; // Blob URL
  blob: Blob;
  transcription: string;
  tags: string[];
  createdAt: number; // Timestamp
  isPermanent: boolean;
  duration: number; // in seconds
}

export enum RecorderState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  PROCESSING = 'PROCESSING',
  PLAYING = 'PLAYING',
}

export interface GeminiResponse {
  text: string;
  tags: string[];
}
