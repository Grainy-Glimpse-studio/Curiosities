import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// Initialize Redis (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const MESSAGES_KEY = 'starcatcher:messages';
const MAX_MESSAGES = 100;

// Simple profanity check (same as frontend)
const BLOCKLIST = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'bastard', 'dick', 'cock', 'pussy',
  'asshole', 'bullshit', 'motherfucker', 'nigger', 'nigga', 'faggot', 'retard',
  'slut', 'whore', 'cunt', '傻逼', '操你', '草泥马', '妈的', '他妈', '干你',
  '废物', '垃圾', '滚蛋', '去死', '白痴', '智障', '脑残', '贱', '婊子',
  '鸡巴', '混蛋', '王八蛋', '狗日', 'sb', 'nmsl', 'cnm',
];

function isClean(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '');
  for (const word of BLOCKLIST) {
    if (normalized.includes(word.toLowerCase())) {
      return false;
    }
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Fetch random message
    if (req.method === 'GET') {
      const messages = await redis.lrange(MESSAGES_KEY, 0, -1);

      if (!messages || messages.length === 0) {
        return res.status(200).json({ message: null });
      }

      // Return a random message
      const randomIndex = Math.floor(Math.random() * messages.length);
      const message = messages[randomIndex];

      return res.status(200).json({ message });
    }

    // POST: Submit new message
    if (req.method === 'POST') {
      const { content, location } = req.body;

      // Validate
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Content is required' });
      }

      const trimmed = content.trim();

      if (trimmed.length < 2 || trimmed.length > 500) {
        return res.status(400).json({ error: 'Message must be 2-500 characters' });
      }

      if (!isClean(trimmed)) {
        return res.status(400).json({ error: 'Please keep it friendly' });
      }

      // Save message with optional fuzzy location
      const message: {
        id: string;
        content: string;
        createdAt: number;
        location?: string;
      } = {
        id: Date.now().toString(),
        content: trimmed,
        createdAt: Date.now(),
      };

      // Add location if provided (already fuzzy from client)
      if (location && typeof location === 'string' && location.length < 100) {
        message.location = location;
      }

      // Add to list (newest first)
      await redis.lpush(MESSAGES_KEY, JSON.stringify(message));

      // Trim to max messages
      await redis.ltrim(MESSAGES_KEY, 0, MAX_MESSAGES - 1);

      return res.status(200).json({ success: true, message });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
