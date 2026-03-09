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
  // ElevenLabs voice settings
  stability?: number;        // 0-1, default 0.5
  similarity_boost?: number; // 0-1, default 0.75
  speed?: number;            // 0.5-2.0, default 1.0
  style?: number;            // 0-1, default 0 (style exaggeration)
  use_speaker_boost?: boolean; // default false
  // Language override
  language_code?: string;    // e.g., "en", "zh", "ja", "ko"
  // Fish Audio specific settings
  temperature?: number;      // 0-1, default 0.7 (expressiveness)
  top_p?: number;            // 0-1, default 0.7 (diversity/stability)
  volume?: number;           // dB, default 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body: TTSRequest = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const {
      provider,
      apiKey,
      voiceId,
      text,
      stability = 0.5,
      similarity_boost = 0.75,
      speed = 1.0,
      style = 0,
      use_speaker_boost = false,
      language_code,
    } = body;

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
      // Build ElevenLabs request body
      const elevenLabsBody: Record<string, unknown> = {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability,
          similarity_boost,
          style,
          use_speaker_boost,
        },
      };

      // Add optional parameters
      if (speed !== 1.0) {
        // ElevenLabs expects speed in the generation config
        elevenLabsBody.generation_config = {
          speed,
        };
      }
      if (language_code) {
        elevenLabsBody.language_code = language_code;
      }

      // Call ElevenLabs API
      const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify(elevenLabsBody),
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
      // Build Fish Audio request body
      const fishAudioBody: Record<string, unknown> = {
        text,
        reference_id: voiceId,
        format: 'mp3',
        latency: 'normal',
      };

      // Add optional parameters
      if (body.temperature !== undefined) {
        fishAudioBody.temperature = body.temperature;
      }
      if (body.top_p !== undefined) {
        fishAudioBody.top_p = body.top_p;
      }
      // Prosody settings (speed, volume)
      if (body.speed !== undefined || body.volume !== undefined) {
        fishAudioBody.prosody = {
          ...(body.speed !== undefined && { speed: body.speed }),
          ...(body.volume !== undefined && { volume: body.volume }),
        };
      }

      // Call Fish Audio API
      const response = await fetch(FISH_AUDIO_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fishAudioBody),
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
