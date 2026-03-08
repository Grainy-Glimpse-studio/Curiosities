/**
 * Deepgram 双路并行语音转写服务
 * 同时开两路连接：一路中文，一路英文
 * 比较 confidence 值，取高的那个显示
 * 实现中英文自动切换效果
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export interface TranscriptionResult {
  text: string;
  tags: string[];
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}

// API base URL
const API_BASE = '/api';

// 生成浏览器指纹
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

interface PendingResult {
  text: string;
  confidence: number;
  language: 'zh' | 'en';
  isFinal: boolean;
  timestamp: number;
  words?: Array<{ word: string; start: number; end: number }>;
}

export class DeepgramDualTranscriber {
  private apiKey: string = '';
  private zhConnection: any = null;
  private enConnection: any = null;
  private transcript: string = '';
  private isListening: boolean = false;
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private lastFinalTimestamp: number = 0;
  private paragraphBreakThreshold: number = 4000;
  private fingerprint: string = '';
  private startTime: number = 0;
  private mode: 'visitor' | 'user' = 'visitor';
  private userApiKey: string = '';

  // 词级时间戳（卡拉OK效果）
  private wordTimestamps: Array<{ word: string; start: number; end: number }> = [];
  private timestampOffset: number = 0; // 语言切换时的时间偏移量
  private audioStartTime: number = 0; // 音频实际开始录制的时间
  private onReadyCallback: ((actualStartTime: number) => void) | null = null;
  private ownsStream: boolean = false; // 是否拥有 stream（用于决定是否在 stop 时释放）

  // 用于比较两路结果
  private pendingResults: Map<string, PendingResult[]> = new Map();
  private resultTimeout: number = 300; // 等待另一路结果的超时时间 (ms)
  private connectionsReady: number = 0;

  constructor(apiKey?: string) {
    this.fingerprint = generateFingerprint();
    if (apiKey) {
      this.userApiKey = apiKey;
      this.apiKey = apiKey;
      this.mode = 'user';
    }
  }

  setUserApiKey(apiKey: string): void {
    this.userApiKey = apiKey;
    this.apiKey = apiKey;
    this.mode = 'user';
  }

  clearUserApiKey(): void {
    this.userApiKey = '';
    this.mode = 'visitor';
  }

  onNewText(callback: ((text: string, isFinal: boolean) => void) | null): void {
    this.onNewTextCallback = callback;
  }

  // 当音频实际开始录制时的回调（用于精确同步时间戳）
  onReady(callback: ((actualStartTime: number) => void) | null): void {
    this.onReadyCallback = callback;
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
      console.log(`[DualTranscriber] Timestamp offset set to ${offset}s`);
    }
  }

  getCurrentTranscript(): string {
    return this.transcript;
  }

  private async getApiKey(): Promise<boolean> {
    if (this.mode === 'user' && this.userApiKey) {
      this.apiKey = this.userApiKey;
      return true;
    }

    try {
      const response = await fetch(`${API_BASE}/deepgram-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: this.fingerprint }),
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

  private async reportUsage(seconds: number): Promise<void> {
    if (this.mode !== 'visitor') return;

    try {
      // 双路并行，用量翻倍
      await fetch(`${API_BASE}/deepgram-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: this.fingerprint,
          usedSeconds: Math.ceil(seconds * 2), // 两路连接
        }),
      });
    } catch (error) {
      console.error('Error reporting usage:', error);
    }
  }

  // 处理转录结果，比较两路 confidence
  private handleTranscriptResult(
    language: 'zh' | 'en',
    text: string,
    confidence: number,
    isFinal: boolean,
    startTime: number,
    words?: Array<{ word: string; start: number; end: number }>
  ): void {
    // 将 startTime 四舍五入到 0.5 秒，以便更好地匹配两路结果
    // 因为两路连接可能有轻微的时间差异
    const roundedStart = Math.round(startTime * 2) / 2;
    const key = `${roundedStart}-${isFinal}`;

    if (!this.pendingResults.has(key)) {
      this.pendingResults.set(key, []);
    }

    const results = this.pendingResults.get(key)!;
    results.push({ text, confidence, language, isFinal, timestamp: Date.now(), words });

    // 如果两路都有结果了，比较并输出
    const zhResult = results.find(r => r.language === 'zh');
    const enResult = results.find(r => r.language === 'en');

    if (zhResult && enResult) {
      this.outputBestResult(zhResult, enResult, isFinal);
      this.pendingResults.delete(key);
    } else {
      // 设置超时，如果另一路没有结果，就用当前的
      setTimeout(() => {
        if (this.pendingResults.has(key)) {
          const currentResults = this.pendingResults.get(key)!;
          if (currentResults.length === 1) {
            const result = currentResults[0];
            this.outputResult(result.text, result.isFinal, result.words);
          }
          this.pendingResults.delete(key);
        }
      }, this.resultTimeout);
    }
  }

  private outputBestResult(zhResult: PendingResult, enResult: PendingResult, isFinal: boolean): void {
    // 比较 confidence，取高的
    let bestResult: PendingResult;

    // 如果其中一个没有文本，用另一个
    if (!zhResult.text.trim() && enResult.text.trim()) {
      bestResult = enResult;
    } else if (zhResult.text.trim() && !enResult.text.trim()) {
      bestResult = zhResult;
    } else if (!zhResult.text.trim() && !enResult.text.trim()) {
      return; // 都没有文本，跳过
    } else {
      // 都有文本，比较 confidence
      bestResult = zhResult.confidence >= enResult.confidence ? zhResult : enResult;
    }

    console.log(`[DualTranscriber] Best result: ${bestResult.language} (zh: ${zhResult.confidence.toFixed(3)}, en: ${enResult.confidence.toFixed(3)}) - "${bestResult.text}"`);

    this.outputResult(bestResult.text, isFinal, bestResult.words);
  }

  private outputResult(text: string, isFinal: boolean, words?: Array<{ word: string; start: number; end: number }>): void {
    if (!text.trim()) return;

    if (isFinal) {
      const now = Date.now();
      if (this.lastFinalTimestamp > 0 && (now - this.lastFinalTimestamp) > this.paragraphBreakThreshold && this.transcript.length > 0) {
        this.transcript += '\n\n';
      }
      this.transcript += text + ' ';
      this.lastFinalTimestamp = now;

      // 存储词级时间戳（加上 timestampOffset 以保持语言切换后的顺序）
      // 防止重叠：检查整个词组的起始时间，如果与已存储的时间戳重叠则跳过
      if (words && Array.isArray(words) && words.length > 0) {
        const firstWordStart = words[0].start + this.timestampOffset;
        const lastStoredEnd = this.wordTimestamps.length > 0
          ? this.wordTimestamps[this.wordTimestamps.length - 1].end
          : -1;

        // 如果这组词的开始时间早于已存储的最后结束时间，说明是重复的结果，跳过时间戳
        if (firstWordStart < lastStoredEnd - 0.3) {
          console.log(`[DualTranscriber] Skipping overlapping timestamps: firstWordStart=${firstWordStart.toFixed(2)}, lastStoredEnd=${lastStoredEnd.toFixed(2)}`);
        } else {
          for (const w of words) {
            this.wordTimestamps.push({
              word: w.word,
              start: w.start + this.timestampOffset,
              end: w.end + this.timestampOffset,
            });
          }
        }
      }
    }

    if (this.onNewTextCallback) {
      this.onNewTextCallback(text, isFinal);
    }
  }

  private createConnection(deepgram: any, language: 'zh-TW' | 'en', label: 'zh' | 'en'): any {
    console.log(`[DualTranscriber] Creating ${label} connection with language: ${language}`);

    const connection = deepgram.listen.live({
      model: 'nova-2',
      language: language,
      punctuate: true,
      smart_format: true,
      interim_results: true,
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const alternative = data.channel?.alternatives?.[0];
      const text = alternative?.transcript || '';
      const confidence = alternative?.confidence || 0;
      const words = alternative?.words;
      const isFinal = data.is_final;
      const start = data.start || 0;

      if (text.trim()) {
        // 转换 words 格式
        const wordTimestamps = words?.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        }));
        this.handleTranscriptResult(label, text, confidence, isFinal, start, wordTimestamps);
      }
    });

    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`[DualTranscriber] ${label} connection opened`);
      this.connectionsReady++;

      // 两路都连接好了才开始录音
      if (this.connectionsReady === 2) {
        this.startMediaRecorder();
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (error: any) => {
      console.error(`[DualTranscriber] ${label} connection error:`, error);
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[DualTranscriber] ${label} connection closed`);
    });

    return connection;
  }

  private startMediaRecorder(): void {
    if (!this.stream) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    const options = mimeType ? { mimeType } : undefined;
    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // 发送同样的音频到两路连接
        if (this.zhConnection) {
          this.zhConnection.send(event.data);
        }
        if (this.enConnection) {
          this.enConnection.send(event.data);
        }
      }
    };

    this.mediaRecorder.start(250);
    this.audioStartTime = Date.now();
    console.log(`[DualTranscriber] MediaRecorder started at ${this.audioStartTime}, sending to both connections`);

    // 通知 HDService 音频实际开始的时间
    if (this.onReadyCallback) {
      this.onReadyCallback(this.audioStartTime);
    }
  }

  async start(existingStream?: MediaStream): Promise<boolean> {
    this.transcript = '';
    this.wordTimestamps = [];
    this.isListening = true;
    this.lastFinalTimestamp = 0;
    this.startTime = Date.now();
    this.connectionsReady = 0;
    this.pendingResults.clear();

    const keyOk = await this.getApiKey();
    if (!keyOk) {
      return false;
    }

    try {
      // 使用已有的 stream 或获取新的
      if (existingStream) {
        this.stream = existingStream;
        this.ownsStream = false;
        console.log('[DualTranscriber] Using existing stream');
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.ownsStream = true;
        console.log('[DualTranscriber] Created new stream');
      }

      const deepgram = createClient(this.apiKey);

      // 创建两路并行连接
      this.zhConnection = this.createConnection(deepgram, 'zh-TW', 'zh');
      this.enConnection = this.createConnection(deepgram, 'en', 'en');

      return true;
    } catch (error) {
      console.error('[DualTranscriber] Failed to start:', error);
      throw error;
    }
  }

  stop(): TranscriptionResult {
    console.log('[DualTranscriber] stop() called');
    console.log('[DualTranscriber] Current transcript length:', this.transcript.length);
    console.log('[DualTranscriber] Current transcript preview:', this.transcript.substring(0, 100));

    this.isListening = false;

    const usedSeconds = (Date.now() - this.startTime) / 1000;
    this.reportUsage(usedSeconds);

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // 只有在自己创建的 stream 时才释放
    if (this.stream && this.ownsStream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.zhConnection) {
      this.zhConnection.finish();
      this.zhConnection = null;
    }

    if (this.enConnection) {
      this.enConnection.finish();
      this.enConnection = null;
    }

    const text = this.transcript.trim();
    const tags = extractTags(text);

    console.log('[DualTranscriber] Returning text length:', text.length);
    console.log('[DualTranscriber] Returning text:', text.substring(0, 100));
    return { text, tags, wordTimestamps: this.wordTimestamps };
  }

  // 获取当前词级时间戳
  getWordTimestamps(): Array<{ word: string; start: number; end: number }> {
    return this.wordTimestamps;
  }

  // 兼容接口
  setLanguage(_lang: string): void {
    // 双路模式忽略语言设置，始终同时使用中英文
    console.log('[DualTranscriber] setLanguage ignored - always using dual zh+en mode');
  }

  isSupported(): boolean {
    return true;
  }
}
