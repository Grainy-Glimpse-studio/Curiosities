/**
 * Deepgram API Key 获取接口
 *
 * 游客模式：返回开发者的 Key，有用量限制
 * 用户模式：用户自己的 Key，无限制
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// 游客限制：每周 10 分钟 = 600 秒（和阿里云共享额度）
const VISITOR_LIMIT_SECONDS = 600;
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

// Redis 客户端
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

interface KeyRequest {
  // 游客模式：提供指纹
  fingerprint?: string;
  // 报告使用时长（秒）
  usedSeconds?: number;
}

// 检查游客用量（和阿里云共享额度）
async function checkVisitorUsage(fingerprint: string): Promise<{ allowed: boolean; usedSeconds: number; remainingSeconds: number }> {
  const key = `visitor:${fingerprint}`;
  const usedSeconds = (await redis.get<number>(key)) || 0;
  const remainingSeconds = Math.max(0, VISITOR_LIMIT_SECONDS - usedSeconds);

  return {
    allowed: usedSeconds < VISITOR_LIMIT_SECONDS,
    usedSeconds,
    remainingSeconds,
  };
}

// 更新游客用量
async function updateVisitorUsage(fingerprint: string, additionalSeconds: number): Promise<void> {
  const key = `visitor:${fingerprint}`;
  const current = (await redis.get<number>(key)) || 0;
  await redis.set(key, current + additionalSeconds, { ex: WEEK_IN_SECONDS });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fingerprint, usedSeconds } = req.body as KeyRequest;

    if (!fingerprint) {
      return res.status(400).json({ error: 'Missing fingerprint' });
    }

    // 如果是报告用量
    if (usedSeconds && usedSeconds > 0) {
      await updateVisitorUsage(fingerprint, usedSeconds);
      const usage = await checkVisitorUsage(fingerprint);
      return res.status(200).json({
        updated: true,
        ...usage,
      });
    }

    // 检查用量限制
    const usage = await checkVisitorUsage(fingerprint);
    if (!usage.allowed) {
      return res.status(403).json({
        error: 'quota_exceeded',
        message: 'Weekly HD quota exceeded',
        ...usage,
      });
    }

    // 检查开发者的 Key 是否配置
    const devApiKey = process.env.DEEPGRAM_API_KEY;

    if (!devApiKey) {
      return res.status(500).json({
        error: 'Deepgram not configured',
      });
    }

    // 返回 API Key（游客模式）
    return res.status(200).json({
      apiKey: devApiKey,
      mode: 'visitor',
      ...usage,
    });

  } catch (error) {
    console.error('Error in deepgram-key:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
