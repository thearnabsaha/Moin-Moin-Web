import {
  enrichedWordSchema,
  enrichedWordsResponseSchema,
  enrichedExpressionSchema,
  enrichedExpressionsResponseSchema,
  type EnrichedWord,
  type EnrichedExpression,
} from './validations';

/**
 * Gemini model cascade ordered by speed, cost-effectiveness, and reliability.
 */
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
] as const;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const BATCH_SIZE = 12;
const MAX_CONCURRENT_BATCHES = 2;

export function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    null
  );
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

interface CallGeminiParams {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  responseMimeType?: string;
  timeoutMs?: number;
  preferredModel?: string;
}

function cleanJsonResponse(raw: string): string {
  let text = raw.trim();
  // Strip markdown code fences if wrapped
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return text.trim();
}

/**
 * Robust Gemini caller with model cascade and per-model timeout.
 */
export async function callGemini(params: CallGeminiParams): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const {
    systemInstruction,
    prompt,
    temperature = 0.2,
    responseMimeType = 'application/json',
    timeoutMs = 15_000,
    preferredModel,
  } = params;

  const startIdx = preferredModel
    ? Math.max(0, GEMINI_MODELS.indexOf(preferredModel as typeof GEMINI_MODELS[number]))
    : 0;

  let lastError: unknown;

  for (let mi = startIdx; mi < GEMINI_MODELS.length; mi++) {
    const model = GEMINI_MODELS[mi];
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType,
        temperature,
      },
    };

    if (systemInstruction) {
      requestBody.system_instruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        const status = response.status;
        console.warn(`[Gemini] Model ${model} returned HTTP ${status}: ${errorText.slice(0, 200)}`);

        // Retryable errors: 404 (model superseded), 429 (rate limit), 500/503 (server issue)
        if (status === 404 || status === 429 || status >= 500) {
          lastError = new Error(`HTTP ${status} on ${model}: ${errorText.slice(0, 150)}`);
          continue;
        }

        throw new Error(`Gemini API error (${status}): ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textPart) {
        throw new Error(`Empty content returned by Gemini model ${model}`);
      }

      return cleanJsonResponse(textPart);
    } catch (err: unknown) {
      lastError = err;
      console.warn(`[Gemini] Error with model ${model}, attempting fallback...`, err);
    }
  }

  throw lastError ?? new Error('All Gemini models exhausted');
}

// ── WORD ENRICHMENT PROMPT & LOGIC ─────────────────────────────

const ENRICH_WORD_SYSTEM_PROMPT = `You are a German language lexicography expert. For each German word or phrase provided, return structured linguistic data in valid JSON.

CRITICAL RULES for interpreting input:
- If the user writes an article + noun (e.g. "die Frau", "der Hund", "das Kind"), treat it as ONE noun entry. The article indicates the gender. The "word" field should be the noun with its article (e.g. "die Frau").
- If the user writes a BARE noun WITHOUT an article (e.g. "Frau", "Hund", "Kind", "Tisch"), you MUST still return the word field WITH its correct definite article prepended (e.g. "Frau" → word: "die Frau", "Hund" → word: "der Hund", "Kind" → word: "das Kind"). Always add the correct article for nouns.
- If the user writes a reflexive verb (e.g. "sich freuen", "sich setzen"), treat it as ONE verb entry.
- Multi-word expressions (e.g. "auf Wiedersehen", "zum Beispiel", "Guten Morgen") should be treated as ONE entry.
- Separable prefix verbs (e.g. "aufstehen", "ankommen") are single verbs.
- NEVER split an article+noun, reflexive pronoun+verb, or multi-word phrase into separate entries.
- Return exactly one entry per numbered input item provided by the user.

Output JSON format:
{
  "words": [
    {
      "word": "string (with article if noun, or reflexive pronoun if reflexive verb)",
      "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "article" | "other",
      "gender": "masculine" | "feminine" | "neuter" | null,
      "plural_form": "string (with article or noun form, or null if not noun)",
      "conjugation": {"ich": "...", "du": "...", "er": "...", "wir": "...", "ihr": "...", "sie": "..."} | null,
      "meaning": "concise English translation",
      "cefr_level": "A1" | "A2" | "B1" | "B2",
      "example_sentence": "simple natural German example sentence",
      "verb_type": "regular" | "irregular" | "mixed" | null,
      "auxiliary_type": "haben" | "sein" | null,
      "present_form": "3rd person singular present (e.g. läuft) or null",
      "simple_past": "3rd person singular past (e.g. lief) or null",
      "perfect_form": "perfect form with auxiliary (e.g. ist gelaufen) or null"
    }
  ]
}`;

export function fallbackEnrichWord(rawWord: string): EnrichedWord {
  const trimmed = rawWord.trim();
  let word = trimmed;
  let partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'pronoun' | 'article' | 'other' = 'other';
  let gender: 'masculine' | 'feminine' | 'neuter' | null = null;
  const pluralForm: string | null = null;
  const meaning = trimmed;
  const cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' = 'A1';
  let exampleSentence: string | null = null;
  let verbType: 'regular' | 'irregular' | 'mixed' | null = null;
  let auxiliaryType: 'haben' | 'sein' | null = null;
  let presentForm: string | null = null;
  let simplePast: string | null = null;
  let perfectForm: string | null = null;
  let conjugation: Record<string, string> | null = null;

  const matchArticle = trimmed.match(/^(der|die|das)\s+(.+)$/i);
  if (matchArticle) {
    const art = matchArticle[1].toLowerCase();
    const noun = matchArticle[2].trim();
    const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1);
    word = `${art} ${capitalizedNoun}`;
    partOfSpeech = 'noun';
    gender = art === 'der' ? 'masculine' : art === 'die' ? 'feminine' : 'neuter';
    exampleSentence = `Ich lerne das Wort ${word}.`;
  } else if (/^[A-ZÄÖÜ]/.test(trimmed) && !trimmed.includes(' ')) {
    if (/ung$|keit$|heit$|schaft$|ion$|ik$|ur$|tät$/i.test(trimmed)) {
      gender = 'feminine';
      word = `die ${trimmed}`;
    } else if (/ling$|or$|ismus$|er$/i.test(trimmed)) {
      gender = 'masculine';
      word = `der ${trimmed}`;
    } else if (/chen$|lein$|ment$|um$|tum$/i.test(trimmed)) {
      gender = 'neuter';
      word = `das ${trimmed}`;
    } else {
      gender = 'masculine';
      word = `der ${trimmed}`;
    }
    partOfSpeech = 'noun';
    exampleSentence = `Das ist ${gender === 'masculine' ? 'ein' : gender === 'feminine' ? 'eine' : 'ein'} ${trimmed}.`;
  } else if (trimmed.endsWith('en') || trimmed.endsWith('eln') || trimmed.endsWith('ern')) {
    partOfSpeech = 'verb';
    const stem = trimmed.endsWith('en') ? trimmed.slice(0, -2) : trimmed.slice(0, -1);
    verbType = 'regular';
    auxiliaryType = 'haben';
    presentForm = `${stem}t`;
    simplePast = `${stem}te`;
    perfectForm = `hat ge${stem}t`;
    conjugation = {
      ich: `${stem}e`,
      du: `${stem}st`,
      er: `${stem}t`,
      wir: `${stem}en`,
      ihr: `${stem}t`,
      sie: `${stem}en`,
    };
    exampleSentence = `Wir ${trimmed} zusammen.`;
  } else {
    partOfSpeech = 'adjective';
    exampleSentence = `Das ist sehr ${trimmed}.`;
  }

  return {
    word,
    part_of_speech: partOfSpeech,
    gender,
    plural_form: pluralForm,
    conjugation,
    meaning,
    cefr_level: cefrLevel,
    example_sentence: exampleSentence,
    verb_type: verbType,
    auxiliary_type: auxiliaryType,
    present_form: presentForm,
    simple_past: simplePast,
    perfect_form: perfectForm,
  };
}

function parseEnrichWordResponse(raw: string | null | undefined): EnrichedWord[] {
  if (!raw) {
    console.error('[Gemini:enrichWords] Empty raw response');
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const wordsArray =
      parsed.words ?? parsed.Words ?? parsed.WORDS ??
      (Array.isArray(parsed) ? parsed : null);

    if (!wordsArray || !Array.isArray(wordsArray)) {
      console.error('[Gemini:enrichWords] No words array found. Keys:', Object.keys(parsed));
      return [];
    }

    const batchResult = enrichedWordsResponseSchema.safeParse({ words: wordsArray });
    if (batchResult.success) {
      return batchResult.data.words;
    }

    console.warn('[Gemini:enrichWords] Batch validation failed, salvaging individual words...');
    const salvaged: EnrichedWord[] = [];
    for (const item of wordsArray) {
      const single = enrichedWordSchema.safeParse(item);
      if (single.success) {
        salvaged.push(single.data);
      } else {
        console.error('[Gemini:enrichWords] Skipped word issue:', single.error.issues);
      }
    }
    return salvaged;
  } catch (err) {
    console.error('[Gemini:enrichWords] JSON parse error:', err, 'Raw response:', raw.slice(0, 300));
    return [];
  }
}

async function enrichWordBatch(words: string[]): Promise<EnrichedWord[]> {
  try {
    const listPrompt = words.map((w, i) => `${i + 1}. ${w}`).join('\n');
    const prompt = `Provide linguistic data for each of these German words/phrases (one entry per item):\n${listPrompt}`;

    const rawResponse = await callGemini({
      systemInstruction: ENRICH_WORD_SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    const parsed = parseEnrichWordResponse(rawResponse);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('[Gemini:enrichWordBatch] Call failed, using local fallback:', err);
  }

  return words.map(fallbackEnrichWord);
}

/**
 * Enriches German words with Gemini AI (gender, articles, CEFR level, conjugations, examples).
 */
export async function enrichWordsWithGemini(words: string[]): Promise<EnrichedWord[]> {
  if (words.length === 0) return [];

  if (words.length <= BATCH_SIZE) {
    return enrichWordBatch(words);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    chunks.push(words.slice(i, i + BATCH_SIZE));
  }

  console.log(`[Gemini:enrichWords] Processing ${words.length} words across ${chunks.length} batches`);
  const allResults: EnrichedWord[] = [];

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
    const concurrentChunks = chunks.slice(i, i + MAX_CONCURRENT_BATCHES);
    const batchResults = await Promise.allSettled(
      concurrentChunks.map((chunk) => enrichWordBatch(chunk))
    );

    for (let idx = 0; idx < batchResults.length; idx++) {
      const res = batchResults[idx];
      if (res && res.status === 'fulfilled' && res.value.length > 0) {
        allResults.push(...res.value);
      } else {
        const failedChunk = concurrentChunks[idx];
        if (failedChunk) {
          allResults.push(...failedChunk.map(fallbackEnrichWord));
        }
      }
    }
  }

  console.log(`[Gemini:enrichWords] Enriched ${allResults.length}/${words.length} words`);
  return allResults;
}

// ── EXPRESSIONS ENRICHMENT ─────────────────────────────────────

const ENRICH_EXPRESSION_SYSTEM_PROMPT = `You are a German language expert specializing in fixed expressions, idioms, and collocations. For each German fixed expression or phrase provided, return structured data in valid JSON.

CRITICAL RULES:
- Treat each input as a single fixed expression (idiom, collocation, greeting, proverb, filler word/phrase, connector phrase, etc.)
- NEVER split a multi-word expression into separate entries.
- Return exactly one entry per numbered input item provided by the user.

Output JSON format:
{
  "expressions": [
    {
      "expression": "string",
      "meaning": "concise English meaning",
      "literal_translation": "string or null",
      "register": "formal" | "informal" | "neutral" | "colloquial" | "slang" | null,
      "cefr_level": "A1" | "A2" | "B1" | "B2",
      "example_sentence": "German sentence illustrating natural usage",
      "usage_note": "brief contextual note on when/how to use",
      "category": "greeting" | "farewell" | "polite" | "idiom" | "collocation" | "proverb" | "filler" | "connector" | "other" | null
    }
  ]
}`;

export function fallbackEnrichExpression(rawExpr: string): EnrichedExpression {
  const trimmed = rawExpr.trim();
  let category: EnrichedExpression['category'] = 'other';
  const lower = trimmed.toLowerCase();

  if (/morgen|tag|abend|hallo|grüß/i.test(lower)) category = 'greeting';
  else if (/wiedersehen|tschüss|ciao|nacht/i.test(lower)) category = 'farewell';
  else if (/bitte|danke|verzeihung|entschuldig/i.test(lower)) category = 'polite';
  else if (/daumen|schwein|blau|bahnhof|tomaten/i.test(lower)) category = 'idiom';

  return {
    expression: trimmed,
    meaning: trimmed,
    literal_translation: null,
    register: 'neutral',
    cefr_level: 'A1',
    example_sentence: `Wir verwenden den Ausdruck: "${trimmed}".`,
    usage_note: null,
    category,
  };
}

function parseEnrichExpressionResponse(raw: string | null | undefined): EnrichedExpression[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const exprsArray =
      parsed.expressions ?? parsed.Expressions ?? parsed.EXPRESSIONS ??
      (Array.isArray(parsed) ? parsed : null);

    if (!exprsArray || !Array.isArray(exprsArray)) {
      return [];
    }

    const batchResult = enrichedExpressionsResponseSchema.safeParse({ expressions: exprsArray });
    if (batchResult.success) {
      return batchResult.data.expressions;
    }

    const salvaged: EnrichedExpression[] = [];
    for (const item of exprsArray) {
      const single = enrichedExpressionSchema.safeParse(item);
      if (single.success) {
        salvaged.push(single.data);
      }
    }
    return salvaged;
  } catch (err) {
    console.error('[Gemini:enrichExpressions] Parse error:', err);
    return [];
  }
}

async function enrichExpressionBatch(expressions: string[]): Promise<EnrichedExpression[]> {
  try {
    const listPrompt = expressions.map((e, i) => `${i + 1}. ${e}`).join('\n');
    const prompt = `Provide linguistic data for each of these German fixed expressions (one entry per item):\n${listPrompt}`;

    const rawResponse = await callGemini({
      systemInstruction: ENRICH_EXPRESSION_SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    const parsed = parseEnrichExpressionResponse(rawResponse);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('[Gemini:enrichExpressionBatch] Call failed, using local fallback:', err);
  }

  return expressions.map(fallbackEnrichExpression);
}

export async function enrichExpressionsWithGemini(expressions: string[]): Promise<EnrichedExpression[]> {
  if (expressions.length === 0) return [];

  if (expressions.length <= BATCH_SIZE) {
    return enrichExpressionBatch(expressions);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < expressions.length; i += BATCH_SIZE) {
    chunks.push(expressions.slice(i, i + BATCH_SIZE));
  }

  const allResults: EnrichedExpression[] = [];
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
    const concurrentChunks = chunks.slice(i, i + MAX_CONCURRENT_BATCHES);
    const batchResults = await Promise.allSettled(
      concurrentChunks.map((chunk) => enrichExpressionBatch(chunk))
    );

    for (let idx = 0; idx < batchResults.length; idx++) {
      const res = batchResults[idx];
      if (res && res.status === 'fulfilled' && res.value.length > 0) {
        allResults.push(...res.value);
      } else {
        const failedChunk = concurrentChunks[idx];
        if (failedChunk) {
          allResults.push(...failedChunk.map(fallbackEnrichExpression));
        }
      }
    }
  }

  return allResults;
}

// Unified export aliases
export const enrichWords = enrichWordsWithGemini;
export const enrichExpressions = enrichExpressionsWithGemini;
