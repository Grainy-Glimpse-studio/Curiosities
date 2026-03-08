// 词级时间戳（用于卡拉OK效果）
export interface WordTimestamp {
  word: string;
  start: number;  // 开始时间（秒）
  end: number;    // 结束时间（秒）
}

export interface Memo {
  id: string;
  // 支持多段音频（Resume 功能）
  audioUrls: string[];           // 多段音频的 URL 数组
  blobs?: Blob[];                // 多段音频的 Blob 数组
  segmentDurations?: number[];   // 每段的时长

  // 向后兼容（旧数据迁移）
  audioUrl?: string;             // 旧格式，单段音频
  blob?: Blob;                   // 旧格式

  transcription: string;
  tags: string[];
  createdAt: number; // Timestamp
  isPermanent: boolean;
  duration: number; // 总时长（所有段之和）
  highlightedWords?: string[]; // Words pinned during recording
  wordTimestamps?: WordTimestamp[]; // 词级时间戳（卡拉OK效果）
  audioOffset?: number; // 音频开头的静音时长（秒），用于 Flow 估算时间戳
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
