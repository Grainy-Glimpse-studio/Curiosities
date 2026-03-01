/**
 * Web Speech API 实时语音转写服务
 * 免费，使用浏览器原生能力
 */

// Web Speech API type declarations
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface TranscriptionResult {
  text: string;
  tags: string[];
}

// 简单的关键词提取作为标签
const extractTags = (text: string): string[] => {
  if (!text || text.trim().length === 0) {
    return ['Empty'];
  }

  // 检测语言
  const isChinese = /[\u4e00-\u9fa5]/.test(text);

  // 简单标签：根据文本长度和内容
  const tags: string[] = [];

  if (text.length < 20) {
    tags.push(isChinese ? '短记录' : 'Short');
  } else if (text.length > 200) {
    tags.push(isChinese ? '长记录' : 'Long');
  }

  // 添加一个默认标签
  if (tags.length === 0) {
    tags.push(isChinese ? '备忘' : 'Memo');
  }

  return tags;
};

export class SpeechTranscriber {
  private recognition: SpeechRecognition | null = null;
  private transcript: string = '';
  private interimTranscript: string = '';
  private isListening: boolean = false;
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private lastFinalTimestamp: number = 0;
  private paragraphBreakThreshold: number = 4000; // 4 seconds for auto-paragraph

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    // 不设置 lang，让浏览器根据系统语言自动识别，支持多语言
    // 用户可以通过 setLanguage() 切换语言

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      this.interimTranscript = interim;

      if (finalTranscript) {
        const now = Date.now();
        // Auto-paragraph: insert break if pause > threshold
        if (this.lastFinalTimestamp > 0 && (now - this.lastFinalTimestamp) > this.paragraphBreakThreshold && this.transcript.length > 0) {
          this.transcript += '\n\n';
        }
        this.transcript += finalTranscript;
        this.lastFinalTimestamp = now;

        // Call callback with final text
        if (this.onNewTextCallback) {
          this.onNewTextCallback(finalTranscript, true);
        }
      } else if (interim && this.onNewTextCallback) {
        // Call callback with interim text
        this.onNewTextCallback(interim, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      // 不要在 no-speech 时停止，继续监听
      if (event.error !== 'no-speech') {
        this.isListening = false;
      }
    };

    this.recognition.onend = () => {
      // 如果还在录音状态，自动重启（continuous 模式有时会意外停止）
      if (this.isListening && this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          // 忽略已经在运行的错误
        }
      }
    };
  }

  // Set callback for new text
  onNewText(callback: ((text: string, isFinal: boolean) => void) | null): void {
    this.onNewTextCallback = callback;
  }

  // Manual paragraph break (Tab key)
  insertParagraphBreak(): void {
    if (this.transcript.length > 0) {
      this.transcript += '\n\n———\n\n';
      this.lastFinalTimestamp = Date.now();
    }
  }

  // Get current transcript including interim
  getCurrentTranscript(): string {
    return this.transcript + (this.interimTranscript ? ` ${this.interimTranscript}` : '');
  }

  start(): void {
    if (!this.recognition) {
      console.warn('Speech recognition not available');
      return;
    }

    this.transcript = '';
    this.interimTranscript = '';
    this.isListening = true;
    this.lastFinalTimestamp = 0;

    try {
      this.recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  }

  stop(): TranscriptionResult {
    this.isListening = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // 忽略
      }
    }

    const text = this.transcript.trim();
    const tags = extractTags(text);

    return { text, tags };
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  // 切换语言：'zh-TW' 繁体中文, 'en-US' 英文, '' 自动检测
  // 需要重启识别才能生效
  setLanguage(lang: string): void {
    if (this.recognition) {
      const wasListening = this.isListening;

      // 如果正在运行，先停止
      if (wasListening) {
        try {
          this.recognition.stop();
        } catch (e) {
          // 忽略
        }
      }

      // 设置新语言
      this.recognition.lang = lang;

      // 如果之前在运行，重新启动
      if (wasListening) {
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (e) {
            // 忽略
          }
        }, 100);
      }
    }
  }
}

// 单例
let transcriberInstance: SpeechTranscriber | null = null;

export const getTranscriber = (): SpeechTranscriber => {
  if (!transcriberInstance) {
    transcriberInstance = new SpeechTranscriber();
  }
  return transcriberInstance;
};
