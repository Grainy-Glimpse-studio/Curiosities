/**
 * 阿里云实时语音转写服务
 * 支持中英混合识别
 * 使用 WebSocket 连接
 */

import { v4 as uuidv4 } from 'uuid';

export interface TranscriptionResult {
  text: string;
  tags: string[];
}

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

  // 简单 hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// API base URL
const API_BASE = '/api';

export class AliyunTranscriber {
  private appKey: string = '';
  private token: string = '';
  private tokenExpireTime: number = 0;
  private connection: WebSocket | null = null;
  private transcript: string = '';
  private isListening: boolean = false;
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private lastFinalTimestamp: number = 0;
  private paragraphBreakThreshold: number = 4000;
  private taskId: string = '';
  private fingerprint: string = '';
  private startTime: number = 0;
  private mode: 'visitor' | 'user' = 'visitor';

  // 用户自己的 Key（可选）
  private userAccessKeyId: string = '';
  private userAccessKeySecret: string = '';
  private userAppKey: string = '';

  constructor() {
    this.fingerprint = generateFingerprint();
  }

  // 设置用户自己的 Key（注册用户）
  setUserCredentials(accessKeyId: string, accessKeySecret: string, appKey: string): void {
    this.userAccessKeyId = accessKeyId;
    this.userAccessKeySecret = accessKeySecret;
    this.userAppKey = appKey;
    this.mode = 'user';
  }

  // 清除用户 Key（切换到游客模式）
  clearUserCredentials(): void {
    this.userAccessKeyId = '';
    this.userAccessKeySecret = '';
    this.userAppKey = '';
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

  // 获取 Token
  private async getToken(): Promise<boolean> {
    try {
      let response: Response;

      if (this.mode === 'user' && this.userAccessKeyId && this.userAccessKeySecret) {
        // 用户模式
        response = await fetch(`${API_BASE}/aliyun-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessKeyId: this.userAccessKeyId,
            accessKeySecret: this.userAccessKeySecret,
          }),
        });
        this.appKey = this.userAppKey;
      } else {
        // 游客模式
        response = await fetch(`${API_BASE}/aliyun-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fingerprint: this.fingerprint,
          }),
        });
      }

      const data = await response.json();

      // 游客模式从 API 响应获取 AppKey
      if (this.mode === 'visitor' && data.appKey) {
        this.appKey = data.appKey;
      }

      if (data.error === 'quota_exceeded') {
        console.warn('HD quota exceeded, will fallback to standard mode');
        return false;
      }

      if (data.token) {
        this.token = data.token;
        this.tokenExpireTime = data.expireTime;
        return true;
      }

      console.error('Failed to get token:', data.error);
      return false;
    } catch (error) {
      console.error('Error getting token:', error);
      return false;
    }
  }

  // 报告使用时长
  private async reportUsage(seconds: number): Promise<void> {
    if (this.mode !== 'visitor') return;

    try {
      await fetch(`${API_BASE}/aliyun-token`, {
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
    this.isListening = true;
    this.lastFinalTimestamp = 0;
    this.taskId = uuidv4().replace(/-/g, '');
    this.startTime = Date.now();

    // 获取 Token
    const tokenOk = await this.getToken();
    if (!tokenOk) {
      return false; // 配额用完或获取失败
    }

    try {
      // 获取麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 创建 WebSocket 连接
      const wsUrl = `wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1?token=${this.token}`;
      this.connection = new WebSocket(wsUrl);

      this.connection.onopen = () => {
        console.log('Aliyun WebSocket connected');
        this.sendStartCommand();
        this.startAudioStream();
      };

      this.connection.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.connection.onerror = (error) => {
        console.error('Aliyun WebSocket error:', error);
      };

      this.connection.onclose = () => {
        console.log('Aliyun WebSocket closed');
        this.isListening = false;
      };

      return true;
    } catch (error) {
      console.error('Failed to start Aliyun transcription:', error);
      throw error;
    }
  }

  private sendStartCommand(): void {
    if (!this.connection) return;

    const startMessage = {
      header: {
        message_id: uuidv4().replace(/-/g, ''),
        task_id: this.taskId,
        namespace: 'SpeechTranscriber',
        name: 'StartTranscription',
        appkey: this.appKey,
      },
      payload: {
        format: 'pcm',
        sample_rate: 16000,
        enable_intermediate_result: true,
        enable_punctuation_prediction: true,
        enable_inverse_text_normalization: true,
      },
    };

    this.connection.send(JSON.stringify(startMessage));
    console.log('Sent StartTranscription command');
  }

  private startAudioStream(): void {
    if (!this.stream || !this.connection) return;

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.stream);

    // 创建处理器节点
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (!this.isListening || !this.connection || this.connection.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);

      // 转换为 16-bit PCM
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // 发送音频数据
      this.connection.send(pcmData.buffer);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const name = message.header?.name;

      if (name === 'TranscriptionResultChanged') {
        // 中间结果
        const text = message.payload?.result;
        if (text && this.onNewTextCallback) {
          this.onNewTextCallback(text, false);
        }
      } else if (name === 'SentenceEnd') {
        // 最终结果
        const text = message.payload?.result;
        if (text) {
          const now = Date.now();
          if (this.lastFinalTimestamp > 0 && (now - this.lastFinalTimestamp) > this.paragraphBreakThreshold && this.transcript.length > 0) {
            this.transcript += '\n\n';
          }
          this.transcript += text;
          this.lastFinalTimestamp = now;

          if (this.onNewTextCallback) {
            this.onNewTextCallback(text, true);
          }
        }
      } else if (name === 'TranscriptionStarted') {
        console.log('Transcription started');
      } else if (name === 'TranscriptionCompleted') {
        console.log('Transcription completed');
      } else if (name === 'TaskFailed') {
        console.error('Task failed:', message.payload);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  stop(): TranscriptionResult {
    this.isListening = false;

    // 计算使用时长并报告
    const usedSeconds = (Date.now() - this.startTime) / 1000;
    this.reportUsage(usedSeconds);

    // 发送停止命令
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      const stopMessage = {
        header: {
          message_id: uuidv4().replace(/-/g, ''),
          task_id: this.taskId,
          namespace: 'SpeechTranscriber',
          name: 'StopTranscription',
          appkey: this.appKey,
        },
      };
      this.connection.send(JSON.stringify(stopMessage));
    }

    // 清理资源
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    const text = this.transcript.trim();
    const tags = extractTags(text);

    return { text, tags };
  }

  isSupported(): boolean {
    return true;
  }
}

// 检查游客配额
export async function checkVisitorQuota(): Promise<{ allowed: boolean; usedSeconds: number; remainingSeconds: number }> {
  const fingerprint = generateFingerprint();

  try {
    const response = await fetch(`${API_BASE}/aliyun-token`, {
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
