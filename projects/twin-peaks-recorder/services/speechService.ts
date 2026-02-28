/**
 * Web Speech API 实时语音转写服务
 * 免费，使用浏览器原生能力
 */

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
  private isListening: boolean = false;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'zh-CN'; // 默认中文，也能识别英文

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.transcript += finalTranscript;
      }
    };

    this.recognition.onerror = (event) => {
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

  start(): void {
    if (!this.recognition) {
      console.warn('Speech recognition not available');
      return;
    }

    this.transcript = '';
    this.isListening = true;

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
}

// 单例
let transcriberInstance: SpeechTranscriber | null = null;

export const getTranscriber = (): SpeechTranscriber => {
  if (!transcriberInstance) {
    transcriberInstance = new SpeechTranscriber();
  }
  return transcriberInstance;
};
