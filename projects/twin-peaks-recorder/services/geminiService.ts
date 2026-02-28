import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts a Blob to a Base64 string.
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const transcribeAndTagAudio = async (audioBlob: Blob): Promise<GeminiResponse> => {
  try {
    const base64Audio = await blobToBase64(audioBlob);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type,
              data: base64Audio,
            },
          },
          {
            text: `You are an intelligent transcription assistant.
                   1. Transcribe the audio file accurately. Detect the language automatically (English or Chinese).
                   2. Analyze the content and generate 1 to 3 short, relevant tags in the *same language* as the audio (e.g., "Dream", "Diane" for English; "梦境", "工作" for Chinese).
                   3. If the audio is silent or unintelligible, return an empty text string and a tag "Noise" or "噪音".`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
          },
          required: ["text", "tags"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
       throw new Error("No response from Gemini");
    }

    return JSON.parse(resultText) as GeminiResponse;

  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    return {
      text: "Transcription failed / 转录失败",
      tags: ["Error"],
    };
  }
};