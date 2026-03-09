import type { VercelRequest, VercelResponse } from '@vercel/node';

// Deepgram API endpoint for file transcription
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Deepgram API key not configured' });
  }

  try {
    // Get the file from the request
    // Note: For Vercel serverless, we need to handle multipart form data differently
    // The file should be in req.body as a buffer when using proper middleware

    const contentType = req.headers['content-type'] || '';

    // For direct audio upload (not multipart)
    if (contentType.includes('audio/') || contentType.includes('video/')) {
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve());
        req.on('error', reject);
      });

      const audioBuffer = Buffer.concat(chunks);

      // Call Deepgram API
      const response = await fetch(`${DEEPGRAM_API_URL}?model=nova-2&smart_format=true&punctuate=true&paragraphs=true&utterances=true&diarize=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Deepgram error:', errorText);
        return res.status(response.status).json({ error: 'Transcription failed', details: errorText });
      }

      const result = await response.json();

      // Extract transcript and word timestamps
      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const words = result.results?.channels?.[0]?.alternatives?.[0]?.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })) || [];

      // Get duration from metadata or calculate from last word
      const duration = result.metadata?.duration || (words.length > 0 ? words[words.length - 1].end : 0);

      return res.status(200).json({
        text: transcript,
        transcript: transcript,
        words: words,
        duration: duration,
      });
    }

    // For multipart form data, we need different handling
    // This is a simplified version - for production, use formidable or similar
    return res.status(400).json({
      error: 'Please send audio data directly with appropriate Content-Type header',
      hint: 'Use Content-Type: audio/mpeg for MP3, audio/wav for WAV, etc.'
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Configure body parsing for large files
export const config = {
  api: {
    bodyParser: false, // Disable body parser to handle raw audio data
  },
};
