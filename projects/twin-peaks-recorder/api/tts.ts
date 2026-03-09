import type { VercelRequest, VercelResponse } from '@vercel/node';

// ElevenLabs API endpoint
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Fish Audio API endpoint
const FISH_AUDIO_API_URL = 'https://api.fish.audio/v1/tts';

interface TTSRequest {
  provider: 'elevenlabs' | 'fish_audio';
  apiKey: string;
  voiceId: string;
  text: string;
  // Optional parameters
  stability?: number;      // ElevenLabs: 0-1, default 0.5
  similarity_boost?: number; // ElevenLabs: 0-1, default 0.75
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body: TTSRequest = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { provider, apiKey, voiceId, text, stability = 0.5, similarity_boost = 0.75 } = body;

    // Validate required fields
    if (!provider || !apiKey || !voiceId || !text) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['provider', 'apiKey', 'voiceId', 'text']
      });
    }

    // Text length limit (prevent abuse)
    if (text.length > 5000) {
      return res.status(400).json({
        error: 'Text too long',
        maxLength: 5000
      });
    }

    let audioBuffer: Buffer;
    let contentType: string;

    if (provider === 'elevenlabs') {
      // Call ElevenLabs API
      const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability,
            similarity_boost,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs error:', errorText);
        return res.status(response.status).json({
          error: 'ElevenLabs TTS failed',
          details: errorText
        });
      }

      audioBuffer = Buffer.from(await response.arrayBuffer());
      contentType = 'audio/mpeg';

    } else if (provider === 'fish_audio') {
      // Call Fish Audio API
      const response = await fetch(FISH_AUDIO_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          reference_id: voiceId,
          format: 'mp3',
          // Fish Audio specific parameters
          latency: 'normal',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fish Audio error:', errorText);
        return res.status(response.status).json({
          error: 'Fish Audio TTS failed',
          details: errorText
        });
      }

      audioBuffer = Buffer.from(await response.arrayBuffer());
      contentType = 'audio/mpeg';

    } else {
      return res.status(400).json({
        error: 'Invalid provider',
        validProviders: ['elevenlabs', 'fish_audio']
      });
    }

    // Return audio data
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', audioBuffer.length);
    return res.send(audioBuffer);

  } catch (error) {
    console.error('TTS error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Configure body parsing
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100kb', // Limit request body size
    },
  },
};
