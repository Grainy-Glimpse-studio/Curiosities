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

  insertParagraphBreak(): void {
    if (this.transcript.length > 0) {
      this.transcript += '\n\n———\n\n';
      this.lastFinalTimestamp = Date.now();
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
    startTime: number
  ): void {
    const key = `${startTime}-${isFinal}`;

    if (!this.pendingResults.has(key)) {
      this.pendingResults.set(key, []);
    }

    const results = this.pendingResults.get(key)!;
    results.push({ text, confidence, language, isFinal, timestamp: Date.now() });

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
            this.outputResult(result.text, result.isFinal);
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

    this.outputResult(bestResult.text, isFinal);
  }

  private outputResult(text: string, isFinal: boolean): void {
    if (!text.trim()) return;

    if (isFinal) {
      const now = Date.now();
      if (this.lastFinalTimestamp > 0 && (now - this.lastFinalTimestamp) > this.paragraphBreakThreshold && this.transcript.length > 0) {
        this.transcript += '\n\n';
      }
      this.transcript += text + ' ';
      this.lastFinalTimestamp = now;
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
      const isFinal = data.is_final;
      const start = data.start || 0;

      if (text.trim()) {
        this.handleTranscriptResult(label, text, confidence, isFinal, start);
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
    console.log('[DualTranscriber] MediaRecorder started, sending to both connections');
  }

  async start(): Promise<boolean> {
    this.transcript = '';
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
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
    this.isListening = false;

    const usedSeconds = (Date.now() - this.startTime) / 1000;
    this.reportUsage(usedSeconds);

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
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

    return { text, tags };
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
