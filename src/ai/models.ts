import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';

export const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

// OpenRouter is OpenAI-compatible; used only as a fallback (E-11a), never the primary path.
export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1',
});

export const REASONING_MODEL = process.env.REASONING_MODEL!;
export const FAST_MODEL = process.env.FAST_MODEL!;
export const FALLBACK_MODEL = process.env.FALLBACK_MODEL!;
