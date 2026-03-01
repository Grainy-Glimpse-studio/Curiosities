/**
 * Deepgram 实时语音转写服务
 * HD 模式，更高精度
 * 使用官方 SDK
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

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

export class DeepgramTranscriber {
  private apiKey: string;
  private connection: any = null;
  private transcript: string = '';
  private isListening: boolean = false;
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private lastFinalTimestamp: number = 0;
  private paragraphBreakThreshold: number = 4000;
  private language: string = 'en'; // 默认英文，可切换

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // 在 start 之前设置语言
  setLanguageBeforeStart(lang: string): void {
    // 转换语言代码
    if (lang === 'zh-TW' || lang === 'zh-CN' || lang === 'zh') {
      this.language = 'zh';
    } else if (lang === 'en-US' || lang === 'en') {
      this.language = 'en';
    } else {
      this.language = 'en'; // 默认英文
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

  getCurrentTranscript(): string {
    return this.transcript;
  }

  async start(): Promise<void> {
    this.transcript = '';
    this.isListening = true;
    this.lastFinalTimestamp = 0;

    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create Deepgram client
      const deepgram = createClient(this.apiKey);

      // Create live transcription connection - 繁体中文 (Nova-2)
      // 注意：Nova-3 不支持中文，必须用 Nova-2
      console.log('Creating Deepgram connection with Nova-2 Traditional Chinese...');
      this.connection = deepgram.listen.live({
        model: 'nova-2',
        language: 'zh-TW',         // 繁体中文
        punctuate: true,
        smart_format: true,
        interim_results: true,
      });

      // Handle transcription results
      this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        console.log('Deepgram transcript received:', data);
        const text = data.channel?.alternatives?.[0]?.transcript;
        const isFinal = data.is_final;

        if (text && text.trim()) {
          if (isFinal) {
            const now = Date.now();
            // Auto-paragraph
            if (this.lastFinalTimestamp > 0 && (now - this.lastFinalTimestamp) > this.paragraphBreakThreshold && this.transcript.length > 0) {
              this.transcript += '\n\n';
            }
            this.transcript += text + ' ';
            this.lastFinalTimestamp = now;

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

        // Check supported mime types
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';

        console.log('Using mimeType:', mimeType);

        // Start sending audio
        const options = mimeType ? { mimeType } : undefined;
        this.mediaRecorder = new MediaRecorder(this.stream!, options);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && this.connection) {
            console.log('Sending audio chunk, size:', event.data.size);
            this.connection.send(event.data);
          }
        };

        this.mediaRecorder.start(250); // Send chunks every 250ms
        console.log('MediaRecorder started');
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('Deepgram error:', error);
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
        this.isListening = false;
      });

    } catch (error) {
      console.error('Failed to start Deepgram transcription:', error);
      throw error;
    }
  }

  stop(): TranscriptionResult {
    this.isListening = false;

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

    return { text, tags };
  }

  setLanguage(lang: string): void {
    // 转换语言代码，下次录音时生效
    if (lang === 'zh-TW' || lang === 'zh-CN' || lang === 'zh') {
      this.language = 'zh';
    } else if (lang === 'en-US' || lang === 'en') {
      this.language = 'en';
    } else {
      this.language = 'en';
    }
    // 注意：Deepgram 不支持录音中切换语言，需要重新开始录音
  }

  isSupported(): boolean {
    return true;
  }
}

// Validate API key by making a test request
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
