/**
 * HD 语音识别服务
 * 统一入口，根据语言选择使用阿里云或 Deepgram
 *
 * 游客模式：
 * - Auto / 中文 → 阿里云（支持中英混合）
 * - English → Deepgram
 *
 * 用户模式：
 * - 根据用户配置的 API 选择
 */

import { AliyunTranscriber, checkVisitorQuota as checkAliyunQuota } from './aliyunService';
import { DeepgramTranscriber, checkDeepgramQuota } from './deepgramService';
import { DeepgramDualTranscriber } from './deepgramDualService';

export interface TranscriptionResult {
  text: string;
  tags: string[];
}

export type LanguageMode = 'auto' | 'zh' | 'en';

export interface HDServiceConfig {
  // 用户自己的 API Keys（可选）
  aliyun?: {
    accessKeyId: string;
    accessKeySecret: string;
    appKey: string;
  };
  deepgram?: {
    apiKey: string;
  };
}

export class HDService {
  private aliyunTranscriber: AliyunTranscriber | null = null;
  private deepgramTranscriber: DeepgramTranscriber | null = null;
  private deepgramDualTranscriber: DeepgramDualTranscriber | null = null;
  private activeTranscriber: AliyunTranscriber | DeepgramTranscriber | DeepgramDualTranscriber | null = null;
  private languageMode: LanguageMode = 'auto';
  private config: HDServiceConfig = {};
  private onNewTextCallback: ((text: string, isFinal: boolean) => void) | null = null;

  constructor() {}

  // 设置用户配置
  setConfig(config: HDServiceConfig): void {
    this.config = config;

    // 如果有阿里云配置
    if (config.aliyun) {
      this.aliyunTranscriber = new AliyunTranscriber();
      this.aliyunTranscriber.setUserCredentials(
        config.aliyun.accessKeyId,
        config.aliyun.accessKeySecret,
        config.aliyun.appKey
      );
    }

    // 如果有 Deepgram 配置
    if (config.deepgram) {
      this.deepgramTranscriber = new DeepgramTranscriber(config.deepgram.apiKey);
    }
  }

  // 清除用户配置（切换到游客模式）
  clearConfig(): void {
    this.config = {};
    if (this.aliyunTranscriber) {
      this.aliyunTranscriber.clearUserCredentials();
    }
    if (this.deepgramTranscriber) {
      this.deepgramTranscriber.clearUserApiKey();
    }
  }

  // 设置语言模式
  setLanguageMode(mode: LanguageMode): void {
    this.languageMode = mode;
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
  // Auto 模式使用双路并行 Deepgram（中英同时识别，比较 confidence）
  // 中文/英文模式使用单路 Deepgram
  private selectTranscriber(): 'aliyun' | 'deepgram' | 'deepgram-dual' {
    // 用户模式：如果只配置了阿里云，用阿里云
    if (this.config.aliyun && !this.config.deepgram) {
      return 'aliyun';
    }
    // Auto 模式使用双路并行
    if (this.languageMode === 'auto') {
      return 'deepgram-dual';
    }
    // 中文/英文模式使用单路
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

    if (service === 'aliyun') {
      // 使用阿里云
      console.log('[HDService] Creating/using AliyunTranscriber');
      if (!this.aliyunTranscriber) {
        this.aliyunTranscriber = new AliyunTranscriber();
      }
      this.aliyunTranscriber.onNewText(this.onNewTextCallback);
      this.activeTranscriber = this.aliyunTranscriber;

      const success = await this.aliyunTranscriber.start();
      if (!success) {
        const isQuota = this.aliyunTranscriber.isQuotaExceeded;
        const error = this.aliyunTranscriber.lastError;
        console.error('[HDService] Aliyun start failed:', { isQuota, error });
        return { success: false, service: 'aliyun', quotaExceeded: isQuota, error };
      }
      return { success: true, service: 'aliyun' };

    } else if (service === 'deepgram-dual') {
      // Auto 模式：使用双路并行 Deepgram（中英同时识别）
      console.log('[HDService] Creating DeepgramDualTranscriber (zh + en parallel)');
      this.deepgramDualTranscriber = new DeepgramDualTranscriber();
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
      console.log(`[HDService] Creating DeepgramTranscriber with language: ${deepgramLang}`);
      this.deepgramTranscriber = new DeepgramTranscriber();
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

// 检查游客配额（两个 API 共享配额）
export async function checkHDQuota(): Promise<{ allowed: boolean; usedSeconds: number; remainingSeconds: number }> {
  // 检查阿里云配额（两个 API 共享同一个配额）
  return await checkAliyunQuota();
}

// 创建单例
let hdServiceInstance: HDService | null = null;

export function getHDService(): HDService {
  if (!hdServiceInstance) {
    hdServiceInstance = new HDService();
  }
  return hdServiceInstance;
}
