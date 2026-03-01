export interface Memo {
  id: string;
  audioUrl: string; // Blob URL or static file path
  blob?: Blob; // Optional for static files
  transcription: string;
  tags: string[];
  createdAt: number; // Timestamp
  isPermanent: boolean;
  duration: number; // in seconds
  highlightedWords?: string[]; // Words pinned during recording
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
