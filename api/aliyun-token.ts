/**
 * 阿里云语音识别 Token 获取 API
 *
 * 用户的 AccessKey 通过 HTTPS 发送到这里
 * 这里用 AccessKey 获取临时 Token
 * 只返回 Token，不返回 AccessKey
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// 阿里云 Token 获取接口
const ALIYUN_TOKEN_URL = 'https://nls-meta.cn-shanghai.aliyuncs.com/';

interface TokenRequest {
  accessKeyId: string;
  accessKeySecret: string;
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
  // 1. 参数排序
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = sortedKeys.map(key =>
    `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
  ).join('&');

  // 2. 构造待签名字符串
  const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(sortedParams)}`;

  // 3. HMAC-SHA1 签名
  const hmac = crypto.createHmac('sha1', accessKeySecret + '&');
  const signature = hmac.update(stringToSign).digest('base64');

  return signature;
}

// 生成随机字符串
function generateNonce(): string {
  return crypto.randomUUID();
}

// 获取 ISO 格式时间
function getISOTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessKeyId, accessKeySecret } = req.body as TokenRequest;

    // 验证参数
    if (!accessKeyId || !accessKeySecret) {
      return res.status(400).json({ error: 'Missing accessKeyId or accessKeySecret' });
    }

    // 构造请求参数
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

    // 生成签名
    const signature = generateSignature('POST', accessKeySecret, params);
    params.Signature = signature;

    // 发送请求到阿里云
    const response = await fetch(ALIYUN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data: AliyunTokenResponse = await response.json();

    if (data.Token) {
      // 成功：只返回 Token，不返回 AccessKey
      return res.status(200).json({
        token: data.Token.Id,
        expireTime: data.Token.ExpireTime,
      });
    } else {
      // 失败
      return res.status(400).json({
        error: data.ErrMsg || 'Failed to get token',
      });
    }
  } catch (error) {
    console.error('Error getting Aliyun token:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
