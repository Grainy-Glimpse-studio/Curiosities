/**
 * Deepgram 实时语音转写服务
 * HD 模式，更高精度
 * 使用官方 SDK
 *
 * 支持：
 * - 游客模式：用开发者的 Key，有用量限制
 * - 用户模式：用用户自己的 Key，无限制
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export interface TranscriptionResult {
  text: string;
  tags: string[];
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}

// API base URL
const API_BASE = '/api';

// 生成浏览器指纹（简单版本）
const generateFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  const canvasData = canvas.toDataURL();

  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    canvasData,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// 简单的关键词提取作为标签
const extractTags = (text: string): string[] => {
  if (!text || text.trim().length === 0) {
    return ['Empty'];
  }

  const isChinese = /[\u4e00-\u9fa5]/.test(text);
  const tags: string[] = [];

  if (text.length < 20) {
    tags.push(isChinese ? '短记录' : 'Short');
  } else if (text.length > 200) {
    tags.push(isChinese ? '长记录' : 'Long');
  }

  if (tags.length === 0) {
    tags.push(isChinese ? '备忘' : 'Memo');
  }

  return tags;
};

export class DeepgramTranscriber {
  private apiKey: string = '';
  private connection: any = null;
  private transcript: string = '';
  private isListening: boolean = false;
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private lastFinalTimestamp: number = 0;
  private paragraphBreakThreshold: number = 4000;
  private language: string = 'en';
  private fingerprint: string = '';
  private startTime: number = 0;
  private mode: 'visitor' | 'user' = 'visitor';

  // 词级时间戳（卡拉OK效果）
  private wordTimestamps: Array<{ word: string; start: number; end: number }> = [];
  private audioStartTime: number = 0; // 录音开始的时间戳，用于计算绝对时间
  private timestampOffset: number = 0; // 语言切换时的时间偏移量

  // 用户自己的 Key（可选）
  private userApiKey: string = '';

  constructor(apiKey?: string) {
    this.fingerprint = generateFingerprint();
    if (apiKey) {
      this.userApiKey = apiKey;
      this.apiKey = apiKey;
      this.mode = 'user';
    }
  }

  // 设置用户自己的 Key（注册用户）
  setUserApiKey(apiKey: string): void {
    this.userApiKey = apiKey;
    this.apiKey = apiKey;
    this.mode = 'user';
  }

  // 清除用户 Key（切换到游客模式）
  clearUserApiKey(): void {
    this.userApiKey = '';
    this.mode = 'visitor';
  }

  setLanguageBeforeStart(lang: string): void {
    if (lang === 'zh-TW' || lang === 'zh-CN' || lang === 'zh') {
      this.language = 'zh-TW'; // Deepgram 用 zh-TW
    } else if (lang === 'en-US' || lang === 'en') {
      this.language = 'en';
    } else {
      this.language = 'en';
    }
  }

  onNewText(callback: ((text: string, isFinal: boolean) => void) | null): void {
    this.onNewTextCallback = callback;
  }

  insertParagraphBreak(): void {
    if (this.transcript.length > 0) {
      this.transcript += '\n\n———\n\n';
      this.lastFinalTimestamp = Date.now();
    }
  }

  // 设置初始 transcript（用于语言切换时恢复之前的内容）
  // offset: 新时间戳需要加上的偏移量（秒），用于保持播放顺序
  setInitialTranscript(text: string, timestamps?: Array<{ word: string; start: number; end: number }>, offset?: number): void {
    this.transcript = text;
    if (timestamps) {
      this.wordTimestamps = timestamps;
    }
    if (offset !== undefined) {
      this.timestampOffset = offset;
      console.log(`[DeepgramTranscriber] Timestamp offset set to ${offset}s`);
    }
  }

  getCurrentTranscript(): string {
    return this.transcript;
  }

  // 获取 API Key（游客模式从后端获取）
  private async getApiKey(): Promise<boolean> {
    if (this.mode === 'user' && this.userApiKey) {
      this.apiKey = this.userApiKey;
      return true;
    }

    // 游客模式：从后端获取
    try {
      const response = await fetch(`${API_BASE}/deepgram-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: this.fingerprint,
        }),
      });

      const data = await response.json();

      if (data.error === 'quota_exceeded') {
        console.warn('HD quota exceeded');
        return false;
      }

      if (data.apiKey) {
        this.apiKey = data.apiKey;
        return true;
      }

      console.error('Failed to get API key:', data.error);
      return false;
    } catch (error) {
      console.error('Error getting API key:', error);
      return false;
    }
  }

  // 报告使用时长
  private async reportUsage(seconds: number): Promise<void> {
    if (this.mode !== 'visitor') return;

    try {
      await fetch(`${API_BASE}/deepgram-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: this.fingerprint,
          usedSeconds: Math.ceil(seconds),
        }),
      });
    } catch (error) {
      console.error('Error reporting usage:', error);
    }
  }

  async start(): Promise<boolean> {
    this.transcript = '';
    this.wordTimestamps = [];
    this.isListening = true;
    this.lastFinalTimestamp = 0;
    this.startTime = Date.now();

    // 获取 API Key
    const keyOk = await this.getApiKey();
    if (!keyOk) {
      return false;
    }

    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create Deepgram client
      const deepgram = createClient(this.apiKey);

      // Create live transcription connection
      console.log(`Creating Deepgram connection with language: ${this.language}`);
      this.connection = deepgram.listen.live({
        model: 'nova-2',
        language: this.language,
        punctuate: true,
        smart_format: true,
        interim_results: true,
      });

      // Handle transcription results
      this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const text = data.channel?.alternatives?.[0]?.transcript;
        const words = data.channel?.alternatives?.[0]?.words;
        const isFinal = data.is_final;

        if (text && text.trim()) {
          if (isFinal) {
            const now = Date.now();
            if (this.lastFinalTimestamp > 0 && (now - this.lastFinalTimestamp) > this.paragraphBreakThreshold && this.transcript.length > 0) {
              this.transcript += '\n\n';
            }
            this.transcript += text + ' ';
            this.lastFinalTimestamp = now;

            // 捕获词级时间戳（卡拉OK效果）
            // 加上 timestampOffset 以保持语言切换后的顺序
            if (words && Array.isArray(words)) {
              for (const w of words) {
                if (w.word && typeof w.start === 'number' && typeof w.end === 'number') {
                  this.wordTimestamps.push({
                    word: w.word,
                    start: w.start + this.timestampOffset,
                    end: w.end + this.timestampOffset,
                  });
                }
              }
            }

            if (this.onNewTextCallback) {
              this.onNewTextCallback(text, true);
            }
          } else {
            if (this.onNewTextCallback) {
              this.onNewTextCallback(text, false);
            }
          }
        }
      });

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened');

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';

        const options = mimeType ? { mimeType } : undefined;
        this.mediaRecorder = new MediaRecorder(this.stream!, options);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && this.connection) {
            this.connection.send(event.data);
          }
        };

        this.mediaRecorder.start(250);
        console.log('MediaRecorder started');
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('Deepgram error:', error);
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
        this.isListening = false;
      });

      return true;
    } catch (error) {
      console.error('Failed to start Deepgram transcription:', error);
      throw error;
    }
  }

  stop(): TranscriptionResult {
    this.isListening = false;

    // 计算使用时长并报告
    const usedSeconds = (Date.now() - this.startTime) / 1000;
    this.reportUsage(usedSeconds);

    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    // Close Deepgram connection
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }

    const text = this.transcript.trim();
    const tags = extractTags(text);

    return { text, tags, wordTimestamps: this.wordTimestamps };
  }

  // 获取当前词级时间戳
  getWordTimestamps(): Array<{ word: string; start: number; end: number }> {
    return this.wordTimestamps;
  }

  setLanguage(lang: string): void {
    console.log(`[DeepgramTranscriber] setLanguage called with: ${lang}`);
    if (lang === 'multi' || lang === 'auto') {
      this.language = 'multi'; // 多语言自动识别
    } else if (lang === 'zh-TW' || lang === 'zh-CN' || lang === 'zh') {
      this.language = 'zh-TW';
    } else if (lang === 'en-US' || lang === 'en') {
      this.language = 'en';
    } else {
      this.language = 'en';
    }
    console.log(`[DeepgramTranscriber] language set to: ${this.language}`);
  }

  isSupported(): boolean {
    return true;
  }
}

// Validate API key
export const validateDeepgramKey = async (apiKey: string): Promise<boolean> => {
  try {
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
};

// 检查游客配额
export async function checkDeepgramQuota(): Promise<{ allowed: boolean; usedSeconds: number; remainingSeconds: number }> {
  const fingerprint = generateFingerprint();

  try {
    const response = await fetch(`${API_BASE}/deepgram-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint }),
    });

    const data = await response.json();

    if (data.error === 'quota_exceeded') {
      return {
        allowed: false,
        usedSeconds: data.usedSeconds || 600,
        remainingSeconds: 0,
      };
    }

    return {
      allowed: true,
      usedSeconds: data.usedSeconds || 0,
      remainingSeconds: data.remainingSeconds || 600,
    };
  } catch {
    return { allowed: false, usedSeconds: 0, remainingSeconds: 0 };
  }
}
