/**
 * 阿里云语音识别 Token 获取 API
 *
 * 两种模式：
 * 1. 游客模式：用开发者的 Key，有用量限制（每周 10 分钟）
 * 2. 用户模式：用用户自己的 Key，无限制
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

// 阿里云 Token 获取接口
const ALIYUN_TOKEN_URL = 'https://nls-meta.cn-shanghai.aliyuncs.com/';

// 游客限制：每周 10 分钟 = 600 秒
const VISITOR_LIMIT_SECONDS = 600;
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

// Redis 客户端（从环境变量获取）
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

interface TokenRequest {
  // 用户模式：提供自己的 Key
  accessKeyId?: string;
  accessKeySecret?: string;
  // 游客模式：提供指纹
  fingerprint?: string;
  // 报告使用时长（秒）
  usedSeconds?: number;
}

interface AliyunTokenResponse {
  Token?: {
    Id: string;
    ExpireTime: number;
  };
  ErrMsg?: string;
}

// 生成阿里云签名
function generateSignature(
  method: string,
  accessKeySecret: string,
  params: Record<string, string>
): string {
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = sortedKeys.map(key =>
    `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
  ).join('&');

  const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(sortedParams)}`;

  const hmac = crypto.createHmac('sha1', accessKeySecret + '&');
  const signature = hmac.update(stringToSign).digest('base64');

  return signature;
}

function generateNonce(): string {
  return crypto.randomUUID();
}

function getISOTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// 获取 Token
async function getAliyunToken(accessKeyId: string, accessKeySecret: string): Promise<{ token: string; expireTime: number } | { error: string }> {
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: 'CreateToken',
    Format: 'JSON',
    RegionId: 'cn-shanghai',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: generateNonce(),
    SignatureVersion: '1.0',
    Timestamp: getISOTimestamp(),
    Version: '2019-02-28',
  };

  const signature = generateSignature('POST', accessKeySecret, params);
  params.Signature = signature;

  const response = await fetch(ALIYUN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data: AliyunTokenResponse = await response.json();

  if (data.Token) {
    return {
      token: data.Token.Id,
      expireTime: data.Token.ExpireTime,
    };
  } else {
    return { error: data.ErrMsg || 'Failed to get token' };
  }
}

// 检查游客用量
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
    const { accessKeyId, accessKeySecret, fingerprint, usedSeconds } = req.body as TokenRequest;

    // 用户模式：用用户自己的 Key
    if (accessKeyId && accessKeySecret) {
      const result = await getAliyunToken(accessKeyId, accessKeySecret);
      if ('error' in result) {
        return res.status(400).json(result);
      }
      return res.status(200).json({
        ...result,
        mode: 'user',
      });
    }

    // 游客模式：用开发者的 Key
    if (fingerprint) {
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
      const devAccessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
      const devAccessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
      const devAppKey = process.env.ALIYUN_APP_KEY;

      if (!devAccessKeyId || !devAccessKeySecret || !devAppKey) {
        return res.status(500).json({
          error: 'HD mode not configured',
        });
      }

      // 获取 Token
      const result = await getAliyunToken(devAccessKeyId, devAccessKeySecret);
      if ('error' in result) {
        return res.status(400).json(result);
      }

      return res.status(200).json({
        ...result,
        appKey: devAppKey, // 返回 AppKey 给前端
        mode: 'visitor',
        ...usage,
      });
    }

    return res.status(400).json({
      error: 'Missing parameters: provide accessKeyId+accessKeySecret or fingerprint',
    });

  } catch (error) {
    console.error('Error in aliyun-token:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
