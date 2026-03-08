// 词级时间戳（用于卡拉OK效果）
export interface WordTimestamp {
  word: string;
  start: number;  // 开始时间（秒）
  end: number;    // 结束时间（秒）
}

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
  wordTimestamps?: WordTimestamp[]; // 词级时间戳（卡拉OK效果）
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
