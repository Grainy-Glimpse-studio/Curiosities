/**
 * 阿里云 DashScope Fun-ASR 实时语音转写服务
 * 使用 fun-asr-realtime 模型
 *
 * 支持：
 * - 中英日混合识别
 * - 20+ 种中文方言（粤语、闽南语等）
 * - 实时流式转写
 *
 * API 文档：https://help.aliyun.com/zh/model-studio/user-guide/speech-recognition
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

// 生成唯一任务 ID
const generateTaskId = (): string => {
  return 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

export class DashScopeTranscriber {
  private apiKey: string = '';
  private websocket: WebSocket | null = null;
  private transcript: string = '';
  private isListening: boolean = false;
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private lastFinalTimestamp: number = 0;
  private paragraphBreakThreshold: number = 4000;
  private language: string = 'auto'; // auto, zh, en, ja
  private taskId: string = '';
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  setUserApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  clearUserApiKey(): void {
    this.apiKey = '';
  }

  setLanguageBeforeStart(lang: string): void {
    this.setLanguage(lang);
  }

  setLanguage(lang: string): void {
    console.log(`[DashScopeTranscriber] setLanguage called with: ${lang}`);
    if (lang === 'auto' || lang === 'multi') {
      this.language = 'auto'; // 自动识别
    } else if (lang === 'zh-TW' || lang === 'zh-CN' || lang === 'zh') {
      this.language = 'zh';
    } else if (lang === 'en-US' || lang === 'en') {
      this.language = 'en';
    } else if (lang === 'ja' || lang === 'ja-JP') {
      this.language = 'ja';
    } else {
      this.language = 'auto';
    }
    console.log(`[DashScopeTranscriber] language set to: ${this.language}`);
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

  async start(): Promise<boolean> {
    if (!this.apiKey) {
      console.error('[DashScopeTranscriber] No API key provided');
      return false;
    }

    this.transcript = '';
    this.isListening = true;
    this.lastFinalTimestamp = 0;
    this.taskId = generateTaskId();

    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create WebSocket connection
      // Auth is passed in the first message's header.authorization field
      const wsUrl = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';
      this.websocket = new WebSocket(wsUrl);

      // Set up audio processing with AudioContext for PCM conversion
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isListening || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send binary audio data
        this.websocket.send(pcmData.buffer);
      };

      return new Promise((resolve) => {
        if (!this.websocket) {
          resolve(false);
          return;
        }

        this.websocket.onopen = () => {
          console.log('[DashScopeTranscriber] WebSocket connected');

          // Send start command
          const startMessage = {
            header: {
              action: 'run-task',
              task_id: this.taskId,
              streaming: 'duplex',
              authorization: `bearer ${this.apiKey}`,
            },
            payload: {
              task_group: 'audio',
              task: 'asr',
              function: 'recognition',
              model: 'paraformer-realtime-v2',
              parameters: {
                format: 'pcm',
                sample_rate: 16000,
                ...(this.language !== 'auto' && { language_hints: [this.language] }),
              },
              input: {},
            },
          };

          this.websocket!.send(JSON.stringify(startMessage));
          console.log('[DashScopeTranscriber] Start message sent:', startMessage);

          // Start audio processing
          this.source!.connect(this.processor!);
          this.processor!.connect(this.audioContext!.destination);
          console.log('[DashScopeTranscriber] Audio processing started');

          resolve(true);
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[DashScopeTranscriber] Received:', data);

            if (data.header?.event === 'task-started') {
              console.log('[DashScopeTranscriber] Task started');
            } else if (data.header?.event === 'result-generated') {
              const output = data.payload?.output;
              if (output?.sentence) {
                const text = output.sentence.text;
                const isFinal = output.sentence.end_time !== undefined;

                if (text && text.trim()) {
                  if (isFinal) {
                    const now = Date.now();
                    if (this.lastFinalTimestamp > 0 &&
                        (now - this.lastFinalTimestamp) > this.paragraphBreakThreshold &&
                        this.transcript.length > 0) {
                      this.transcript += '\n\n';
                    }
                    this.transcript += text + ' ';
                    this.lastFinalTimestamp = now;
                  }

                  if (this.onNewTextCallback) {
                    this.onNewTextCallback(text, isFinal);
                  }
                }
              }
            } else if (data.header?.event === 'task-failed') {
              console.error('[DashScopeTranscriber] Task failed:', data.payload?.message);
            }
          } catch (error) {
            console.error('[DashScopeTranscriber] Error parsing message:', error);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('[DashScopeTranscriber] WebSocket error:', error);
          resolve(false);
        };

        this.websocket.onclose = (event) => {
          console.log('[DashScopeTranscriber] WebSocket closed:', event.code, event.reason);
          this.isListening = false;
        };
      });
    } catch (error) {
      console.error('[DashScopeTranscriber] Failed to start:', error);
      return false;
    }
  }

  stop(): TranscriptionResult {
    this.isListening = false;

    // Send stop command
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      const stopMessage = {
        header: {
          action: 'finish-task',
          task_id: this.taskId,
          streaming: 'duplex',
        },
        payload: {
          input: {},
        },
      };
      this.websocket.send(JSON.stringify(stopMessage));
    }

    // Stop audio processing
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Stop stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Close WebSocket
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    const text = this.transcript.trim();
    const tags = extractTags(text);

    return { text, tags };
  }

  isSupported(): boolean {
    return 'WebSocket' in window && 'AudioContext' in window;
  }
}

// Validate API key by making a simple API call
export const validateDashScopeKey = async (apiKey: string): Promise<boolean> => {
  try {
    // Use the models list endpoint to validate
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
};
