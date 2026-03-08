/**
 * HD 语音识别服务
 * 统一入口，根据用户配置选择使用 Deepgram 或 DashScope
 *
 * 游客模式：
 * - 使用 Deepgram（开发者 Key，有配额限制）
 *
 * 用户模式：
 * - 根据用户配置的 API 选择
 * - 如果配置了多个 API，使用 primarySpeechApi 指定的
 */

import { DeepgramTranscriber, checkDeepgramQuota } from './deepgramService';
import { DeepgramDualTranscriber } from './deepgramDualService';
import { DashScopeTranscriber } from './dashscopeService';

export interface TranscriptionResult {
  text: string;
  tags: string[];
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}

export type LanguageMode = 'auto' | 'zh' | 'en';

export interface HDServiceConfig {
  // 用户自己的 API Keys（可选）
  deepgram?: {
    apiKey: string;
  };
  dashscope?: {
    apiKey: string;
  };
  // 当配置了多个 API 时，选择主要使用哪个
  primarySpeechApi?: 'deepgram' | 'dashscope';
}

export class HDService {
  private deepgramTranscriber: DeepgramTranscriber | null = null;
  private deepgramDualTranscriber: DeepgramDualTranscriber | null = null;
  private dashscopeTranscriber: DashScopeTranscriber | null = null;
  private activeTranscriber: DeepgramTranscriber | DeepgramDualTranscriber | DashScopeTranscriber | null = null;
  private languageMode: LanguageMode = 'auto';
  private config: HDServiceConfig = {};
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;

  constructor() {}

  // 设置用户配置
  setConfig(config: HDServiceConfig): void {
    this.config = config;

    // 如果有 Deepgram 配置
    if (config.deepgram) {
      this.deepgramTranscriber = new DeepgramTranscriber(config.deepgram.apiKey);
    }

    // 如果有 DashScope 配置
    if (config.dashscope) {
      this.dashscopeTranscriber = new DashScopeTranscriber(config.dashscope.apiKey);
    }
  }

  // 清除用户配置（切换到游客模式）
  clearConfig(): void {
    this.config = {};
    if (this.deepgramTranscriber) {
      this.deepgramTranscriber.clearUserApiKey();
    }
    if (this.dashscopeTranscriber) {
      this.dashscopeTranscriber.clearUserApiKey();
    }
  }

  // 设置语言模式
  setLanguageMode(mode: LanguageMode): void {
    this.languageMode = mode;
  }

  // 录音中切换语言（重启连接）
  async switchLanguage(newMode: LanguageMode): Promise<boolean> {
    if (!this.activeTranscriber) {
      // 没在录音，只更新模式
      this.languageMode = newMode;
      return true;
    }

    console.log(`[HDService] Switching language from ${this.languageMode} to ${newMode}`);

    // 保存当前已识别的文本和词级时间戳
    const currentTranscript = this.activeTranscriber.getCurrentTranscript();
    const currentTimestamps = this.activeTranscriber.getWordTimestamps?.() || [];
    console.log(`[HDService] Saving current transcript (${currentTranscript.length} chars, ${currentTimestamps.length} words)`);

    // 计算时间偏移量：新语言的时间戳需要加上之前最大的结束时间
    // 这样播放时顺序才是正确的
    let timestampOffset = 0;
    if (currentTimestamps.length > 0) {
      timestampOffset = Math.max(...currentTimestamps.map(t => t.end)) + 0.5; // 加 0.5 秒间隔
      console.log(`[HDService] Calculated timestamp offset: ${timestampOffset}s`);
    }

    // 停止当前连接（不报告用量，因为还要继续）
    if (this.activeTranscriber) {
      this.activeTranscriber.stop();
    }

    // 更新语言模式
    this.languageMode = newMode;

    // 用新语言重新开始
    const result = await this.start();

    if (result.success && this.activeTranscriber) {
      // 恢复之前的文本、时间戳，并传递时间偏移量
      if (currentTranscript.trim()) {
        const restoredTranscript = currentTranscript + '\n\n———\n\n';
        this.activeTranscriber.setInitialTranscript(restoredTranscript, currentTimestamps, timestampOffset);
        console.log(`[HDService] Restored transcript with separator, ${currentTimestamps.length} word timestamps, offset ${timestampOffset}s`);
      }
      console.log(`[HDService] Language switched successfully to ${newMode}`);
    }

    return result.success;
  }

  // 设置回调
  onNewText(callback: ((text: string, isFinal: boolean) => void) | null): void {
    this.onNewTextCallback = callback;
  }

  // 插入段落分隔
  insertParagraphBreak(): void {
    if (this.activeTranscriber) {
      this.activeTranscriber.insertParagraphBreak();
    }
  }

  // 获取当前转写文本
  getCurrentTranscript(): string {
    if (this.activeTranscriber) {
      return this.activeTranscriber.getCurrentTranscript();
    }
    return '';
  }

  // 选择使用哪个 API
  // 优先级：
  // 1. 如果设置了 primarySpeechApi，使用用户选择的
  // 2. 如果只配置了一个 API，使用那个
  // 3. 默认使用 Deepgram（游客模式）
  private selectTranscriber(): 'deepgram' | 'deepgram-dual' | 'dashscope' {
    // 如果设置了首选 API
    if (this.config.primarySpeechApi === 'dashscope' && this.config.dashscope) {
      return 'dashscope';
    }
    if (this.config.primarySpeechApi === 'deepgram' && this.config.deepgram) {
      // Auto 模式使用双路并行
      if (this.languageMode === 'auto') {
        return 'deepgram-dual';
      }
      return 'deepgram';
    }

    // 如果只配置了 DashScope，使用 DashScope
    if (this.config.dashscope && !this.config.deepgram) {
      return 'dashscope';
    }

    // 默认使用 Deepgram（游客模式或用户只配置了 Deepgram）
    // Auto 模式使用双路并行
    if (this.languageMode === 'auto') {
      return 'deepgram-dual';
    }
    return 'deepgram';
  }

  // 根据语言模式获取 Deepgram 的语言参数
  private getDeepgramLanguage(): string {
    switch (this.languageMode) {
      case 'zh':
        return 'zh-TW'; // 繁体中文
      case 'en':
        return 'en';
      default:
        return 'en';
    }
  }

  // 开始录音
  async start(): Promise<{ success: boolean; service: string; quotaExceeded?: boolean; error?: string }> {
    const service = this.selectTranscriber();
    console.log(`[HDService] Language mode: ${this.languageMode}, Selected service: ${service}`);

    if (service === 'dashscope') {
      // 使用 DashScope
      console.log('[HDService] Creating/using DashScopeTranscriber');
      if (!this.dashscopeTranscriber) {
        this.dashscopeTranscriber = new DashScopeTranscriber(this.config.dashscope?.apiKey);
      }
      this.dashscopeTranscriber.setLanguage(this.languageMode === 'zh' ? 'zh' : this.languageMode === 'en' ? 'en' : 'auto');
      this.dashscopeTranscriber.onNewText(this.onNewTextCallback);
      this.activeTranscriber = this.dashscopeTranscriber;

      const success = await this.dashscopeTranscriber.start();
      if (!success) {
        console.error('[HDService] DashScope start failed');
        return { success: false, service: 'dashscope', error: 'Failed to start DashScope transcription' };
      }
      return { success: true, service: 'dashscope' };

    } else if (service === 'deepgram-dual') {
      // Auto 模式：使用双路并行 Deepgram（中英同时识别）
      const userKey = this.config.deepgram?.apiKey;
      console.log(`[HDService] Creating DeepgramDualTranscriber (zh + en parallel), userKey: ${userKey ? 'YES' : 'NO'}`);
      this.deepgramDualTranscriber = new DeepgramDualTranscriber(userKey);
      this.deepgramDualTranscriber.onNewText(this.onNewTextCallback);
      this.activeTranscriber = this.deepgramDualTranscriber;

      const success = await this.deepgramDualTranscriber.start();
      if (!success) {
        return { success: false, service: 'deepgram-dual', quotaExceeded: true };
      }
      return { success: true, service: 'deepgram-dual' };

    } else {
      // 中文/英文模式：使用单路 Deepgram
      const deepgramLang = this.getDeepgramLanguage();
      const userKey = this.config.deepgram?.apiKey;
      console.log(`[HDService] Creating DeepgramTranscriber with language: ${deepgramLang}, userKey: ${userKey ? 'YES' : 'NO'}`);
      this.deepgramTranscriber = new DeepgramTranscriber(userKey);
      this.deepgramTranscriber.setLanguage(deepgramLang);
      this.deepgramTranscriber.onNewText(this.onNewTextCallback);
      this.activeTranscriber = this.deepgramTranscriber;

      const success = await this.deepgramTranscriber.start();
      if (!success) {
        return { success: false, service: 'deepgram', quotaExceeded: true };
      }
      return { success: true, service: 'deepgram' };
    }
  }

  // 停止录音
  stop(): TranscriptionResult {
    if (this.activeTranscriber) {
      const result = this.activeTranscriber.stop();
      this.activeTranscriber = null;
      return result;
    }
    return { text: '', tags: [] };
  }

  // 检查是否支持
  isSupported(): boolean {
    return true;
  }
}

// 检查游客配额（使用 Deepgram 配额）
export async function checkHDQuota(): Promise<{ allowed: boolean; usedSeconds: number; remainingSeconds: number }> {
  return await checkDeepgramQuota();
}

// 创建单例
let hdServiceInstance: HDService | null = null;

export function getHDService(): HDService {
  if (!hdServiceInstance) {
    hdServiceInstance = new HDService();
  }
  return hdServiceInstance;
}
