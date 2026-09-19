import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/get-user';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    null
  );
}

function getGroqApiKey(): string | null {
  return (
    process.env.GROQ_API_KEY ||
    process.env.NEXT_PUBLIC_GROQ_API_KEY ||
    null
  );
}

interface AiServiceStatus {
  name: string;
  configured: boolean;
  status: 'operational' | 'rate_limited' | 'error' | 'unconfigured';
  latencyMs: number | null;
  model: string | null;
  error: string | null;
  rateLimitInfo: {
    remaining: number | null;
    limit: number | null;
    resetAt: string | null;
  } | null;
}

async function probeGemini(): Promise<AiServiceStatus> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { name: 'Google Gemini', configured: false, status: 'unconfigured', latencyMs: null, model: null, error: null, rateLimitInfo: null };
  }

  const model = 'gemini-3.5-flash-lite';
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: {"status":"ok"}' }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 10 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    // Extract rate limit headers
    const rateLimitInfo = {
      remaining: response.headers.get('x-ratelimit-remaining') ? parseInt(response.headers.get('x-ratelimit-remaining')!) : null,
      limit: response.headers.get('x-ratelimit-limit') ? parseInt(response.headers.get('x-ratelimit-limit')!) : null,
      resetAt: response.headers.get('x-ratelimit-reset') || response.headers.get('retry-after') || null,
    };

    if (response.status === 429) {
      const errorText = await response.text();
      return {
        name: 'Google Gemini',
        configured: true,
        status: 'rate_limited',
        latencyMs,
        model,
        error: `Rate limited (429): ${errorText.slice(0, 100)}`,
        rateLimitInfo,
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name: 'Google Gemini',
        configured: true,
        status: 'error',
        latencyMs,
        model,
        error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`,
        rateLimitInfo,
      };
    }

    return {
      name: 'Google Gemini',
      configured: true,
      status: 'operational',
      latencyMs,
      model,
      error: null,
      rateLimitInfo,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      name: 'Google Gemini',
      configured: true,
      status: 'error',
      latencyMs,
      model,
      error: message.includes('abort') ? 'Timeout (>8s)' : message.slice(0, 100),
      rateLimitInfo: null,
    };
  }
}

async function probeGroq(): Promise<AiServiceStatus> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return { name: 'Groq', configured: false, status: 'unconfigured', latencyMs: null, model: null, error: null, rateLimitInfo: null };
  }

  const model = 'openai/gpt-oss-20b';
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
        temperature: 0,
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    // Groq returns rate limit info in standard headers
    const rateLimitInfo = {
      remaining: response.headers.get('x-ratelimit-remaining-requests')
        ? parseInt(response.headers.get('x-ratelimit-remaining-requests')!)
        : response.headers.get('x-ratelimit-remaining')
          ? parseInt(response.headers.get('x-ratelimit-remaining')!)
          : null,
      limit: response.headers.get('x-ratelimit-limit-requests')
        ? parseInt(response.headers.get('x-ratelimit-limit-requests')!)
        : response.headers.get('x-ratelimit-limit')
          ? parseInt(response.headers.get('x-ratelimit-limit')!)
          : null,
      resetAt: response.headers.get('x-ratelimit-reset-requests')
        || response.headers.get('x-ratelimit-reset')
        || response.headers.get('retry-after')
        || null,
    };

    if (response.status === 429) {
      const errorText = await response.text();
      return {
        name: 'Groq',
        configured: true,
        status: 'rate_limited',
        latencyMs,
        model,
        error: `Rate limited (429): ${errorText.slice(0, 100)}`,
        rateLimitInfo,
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name: 'Groq',
        configured: true,
        status: 'error',
        latencyMs,
        model,
        error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`,
        rateLimitInfo,
      };
    }

    return {
      name: 'Groq',
      configured: true,
      status: 'operational',
      latencyMs,
      model,
      error: null,
      rateLimitInfo,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      name: 'Groq',
      configured: true,
      status: 'error',
      latencyMs,
      model,
      error: message.includes('abort') ? 'Timeout (>10s)' : message.slice(0, 100),
      rateLimitInfo: null,
    };
  }
}

export async function GET() {
  try {
    await getCurrentUserId(); // auth guard

    const [gemini, groq] = await Promise.all([probeGemini(), probeGroq()]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      services: [gemini, groq],
    });
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
