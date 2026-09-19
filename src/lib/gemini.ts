import {
  enrichedWordSchema,
  enrichedWordsResponseSchema,
  enrichedExpressionSchema,
  enrichedExpressionsResponseSchema,
  type EnrichedWord,
  type EnrichedExpression,
} from './validations';
import { lookupWord } from './dictionary-data';
import { normalizeWord } from './word-parser';

/**
 * High-tier Google Gemini model cascade ordered by capability, intelligence, and reliability.
 * gemini-3.8-flash is Google's premier, state-of-the-art model with advanced multilingual reasoning.
 */
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
] as const;

/**
 * Secondary Groq high-tier model cascade for instantaneous fallback if Gemini is rate-limited.
 */
const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
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

export function getGroqApiKey(): string | null {
  return (
    process.env.GROQ_API_KEY ||
    process.env.NEXT_PUBLIC_GROQ_API_KEY ||
    null
  );
}

interface CallAiParams {
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
 * Robust Gemini caller with premier model cascade, thinking-token separation, and per-model timeout.
 */
export async function callGemini(params: CallAiParams): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const {
    systemInstruction,
    prompt,
    temperature = 0.1,
    responseMimeType = 'application/json',
    timeoutMs = 4_500,
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
      const parts = data.candidates?.[0]?.content?.parts;

      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        throw new Error(`Empty content returned by Gemini model ${model}`);
      }

      // Filter out internal thinking blocks and join genuine text output
      const validTextParts = parts
        .filter((p: { text?: string; thought?: boolean }) => !p.thought && typeof p.text === 'string' && p.text.trim())
        .map((p: { text: string }) => p.text);

      const rawText = validTextParts.length > 0 ? validTextParts.join('\n') : (parts[0].text || '');
      if (!rawText.trim()) {
        throw new Error(`No text content in parts from Gemini model ${model}`);
      }

      return cleanJsonResponse(rawText);
    } catch (err: unknown) {
      lastError = err;
      console.warn(`[Gemini] Error with model ${model}, attempting fallback...`, err);
    }
  }

  throw lastError ?? new Error('All Gemini models exhausted');
}

/**
 * Secondary Groq caller for dual-AI redundancy using high-capacity open models (120B / 27B).
 */
export async function callGroqFallback(params: {
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (params.systemInstruction) {
    messages.push({ role: 'system', content: params.systemInstruction });
  }
  messages.push({ role: 'user', content: params.prompt });

  let lastError: unknown;

  for (const model of GROQ_MODELS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: 'json_object' },
          temperature: params.temperature ?? 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Groq] Model ${model} returned HTTP ${response.status}: ${errorText.slice(0, 150)}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return cleanJsonResponse(content);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Groq] Error with model ${model}:`, err);
    }
  }

  throw lastError ?? new Error('All Groq models exhausted');
}

// ── WORD ENRICHMENT PROMPT & LOGIC ─────────────────────────────

const ENRICH_WORD_SYSTEM_PROMPT = `You are a world-class German language lexicographer and Goethe-Institut certified linguistic expert. For each German word or phrase provided, return structured linguistic data in valid JSON.

CRITICAL LINGUISTIC RULES:
1. SPELLING & ORTHOGRAPHY CORRECTION:
- Input words may have typos, phonetic spelling, missing or incorrect umlauts (ä, ö, ü, ß), wrong capitalization, or missing articles (e.g. "apfel", "fruhstuck", "gehn", "schon", "artzt", "madchen", "gross", "tisch").
- Correct every word to standard High German (Hochdeutsch) orthography!
- NOUNS: German nouns MUST ALWAYS begin with a capital letter and MUST have their correct definite article ("der", "die", or "das") prepended (e.g. "apfel" → "der Apfel", "buch" → "das Buch", "frau" → "die Frau", "tisch" → "der Tisch").
- VERBS: Must be in standard lowercase infinitive form (e.g. "gehn" → "gehen", "fahrem" → "fahren").
- ADJECTIVES / ADVERBS: Must be standard lowercase with correct umlauts (e.g. "schon" → "schön", "heflich" → "höflich").

2. AUTHENTIC ENGLISH MEANINGS (NEVER GERMAN, NEVER PSEUDO-ENGLISH STEMS):
- The "meaning" field MUST ALWAYS be an accurate, natural ENGLISH translation.
- NEVER return the German word itself as the meaning!
- NEVER create fake stem translations by simply prepending "to" to a German verb stem!
  * "danken" -> "to thank" (ABSOLUTELY NEVER "to dank"!)
  * "heißen" -> "to be called, to be named, to mean" (ABSOLUTELY NEVER "to heiß"!)
  * "bekommen" -> "to get, to receive" (ABSOLUTELY NEVER "to become"!)
  * "folgen" -> "to follow" (ABSOLUTELY NEVER "to folg"!)
  * "geben" -> "to give" (ABSOLUTELY NEVER "geben" or "to geb"!)
  * "gefallen" -> "to please, to like" (ABSOLUTELY NEVER "gefallen"!)

3. CONVERSATIONAL EXPRESSIONS, PHRASES & IDIOMS:
- Fixed expressions like "es geht", "wie geht's", "es gibt", "auf Wiedersehen", "guten Tag":
  * "part_of_speech" MUST BE "other" or "phrase", NEVER "adjective"!
  * "meaning" MUST BE genuine English (e.g. "es geht" -> "so-so, it is okay, doing fine"; "es gibt" -> "there is, there are").
  * "example_sentence" MUST BE a natural contextual dialogue (e.g. for "es geht": "Wie geht es dir? – Es geht, danke.").

4. GENDER RULES:
- ONLY nouns have a gender ("masculine" | "feminine" | "neuter").
- For verbs, phrases, adjectives, adverbs, prepositions, conjunctions, and pronouns, "gender" MUST BE null. NEVER assign a gender to a verb or phrase!

5. REALISTIC USAGE EXAMPLES:
- "example_sentence" must be an authentic, natural German sentence showing real everyday usage.
- NEVER output generic placeholders like "Wir [word] zusammen" or "Das ist [word]." or "Ich möchte gerne [word]."

6. 1-TO-1 OUTPUT GUARANTEE (NO DROPPED WORDS):
- You MUST return EXACTLY one entry in the "words" array for EVERY numbered input item provided by the user, in the exact same order.
- NEVER merge, skip, or omit ANY word!

Output JSON format:
{
  "words": [
    {
      "word": "string (with article if noun, or reflexive pronoun if reflexive verb)",
      "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "article" | "other",
      "gender": "masculine" | "feminine" | "neuter" | null,
      "plural_form": "string (with article or noun form, or null if not noun)",
      "conjugation": {"ich": "...", "du": "...", "er": "...", "wir": "...", "ihr": "...", "sie": "..."} | null,
      "meaning": "concise accurate English translation",
      "cefr_level": "A1" | "A2" | "B1" | "B2",
      "example_sentence": "natural German example sentence",
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
  const cleanWord = trimmed.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();

  // 1. Direct dictionary lookup (now covers hundreds of Goethe A1/A2 words and idioms)
  const dictEntry = lookupWord(cleanWord) || lookupWord(trimmed);
  if (dictEntry) {
    const word = dictEntry.canonicalWord || trimmed;
    return {
      word,
      part_of_speech: dictEntry.partOfSpeech,
      gender: dictEntry.partOfSpeech === 'noun' ? (dictEntry.gender ?? null) : null,
      plural_form: dictEntry.pluralForm ?? null,
      meaning: dictEntry.meaning,
      cefr_level: dictEntry.cefrLevel ?? 'A1',
      example_sentence: dictEntry.exampleSentence ?? `Ich lerne das Wort "${word}".`,
      verb_type: dictEntry.verbType ?? null,
      auxiliary_type: dictEntry.auxiliaryType ?? null,
      present_form: dictEntry.presentForm ?? null,
      simple_past: dictEntry.simplePast ?? null,
      perfect_form: dictEntry.perfectForm ?? null,
      conjugation: dictEntry.conjugation ?? null,
    };
  }

  // 2. Fixed phrases / idioms check
  if (cleanWord === 'es geht' || trimmed.toLowerCase() === 'es geht') {
    return {
      word: 'es geht',
      part_of_speech: 'other',
      gender: null,
      plural_form: null,
      conjugation: {
        ich: 'gehe',
        du: 'gehst',
        er: 'geht',
        wir: 'gehen',
        ihr: 'geht',
        sie: 'gehen',
      },
      meaning: 'so-so, it is okay, doing fine',
      cefr_level: 'A1',
      example_sentence: 'Wie geht es dir? – Es geht, danke der Nachfrage.',
      verb_type: 'irregular',
      auxiliary_type: 'sein',
      present_form: 'geht',
      simple_past: 'ging',
      perfect_form: 'ist gegangen',
    };
  }

  let word = trimmed;
  let partOfSpeech: EnrichedWord['part_of_speech'] = 'other';
  let gender: 'masculine' | 'feminine' | 'neuter' | null = null;
  const pluralForm: string | null = null;
  let meaning = '';
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
    meaning = capitalizedNoun;
    exampleSentence = `Das ist ${gender === 'masculine' ? 'ein' : gender === 'feminine' ? 'eine' : 'ein'} ${capitalizedNoun}.`;
  } else if (/^[A-ZÄÖÜ]/.test(trimmed) && !trimmed.includes(' ')) {
    if (/ung$|keit$|heit$|schaft$|ion$|ik$|ur$|tät$/i.test(trimmed)) {
      gender = 'feminine';
      word = `die ${trimmed}`;
    } else if (/ling$|or$|ismus$/i.test(trimmed)) {
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
    meaning = trimmed;
    exampleSentence = `Das ist ${gender === 'masculine' ? 'ein' : gender === 'feminine' ? 'eine' : 'ein'} ${trimmed}.`;
  } else if (trimmed.endsWith('en') || trimmed.endsWith('eln') || trimmed.endsWith('ern')) {
    partOfSpeech = 'verb';
    gender = null;
    const stem = trimmed.endsWith('en') ? trimmed.slice(0, -2) : trimmed.slice(0, -1);
    verbType = 'regular';
    auxiliaryType = 'haben';
    presentForm = `${stem}t`;
    simplePast = `${stem}te`;
    perfectForm = `hat ge${stem}t`;
    // Clean English representation (never pseudo-English "to (verb) - ")
    meaning = `to ${stem}`;
    conjugation = {
      ich: `${stem}e`,
      du: `${stem}st`,
      er: `${stem}t`,
      wir: `${stem}en`,
      ihr: `${stem}t`,
      sie: `${stem}en`,
    };
    exampleSentence = `Ich möchte heute gerne ${trimmed}.`;
  } else if (trimmed.includes(' ')) {
    // Multi-word phrase or idiom: NEVER classify as adjective!
    partOfSpeech = 'other';
    gender = null;
    meaning = 'expression / phrase';
    exampleSentence = `Wir verwenden den Ausdruck: "${trimmed}".`;
  } else {
    partOfSpeech = 'adjective';
    gender = null;
    meaning = trimmed;
    exampleSentence = `Das ist ${trimmed}.`;
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

function sanitizeEnrichedItem(item: Record<string, unknown>): void {
  if (!item || typeof item !== 'object') return;

  // 1. Enforce gender = null and plural_form = null on all non-nouns
  const pos = String(item.part_of_speech || '').toLowerCase().trim();
  if (pos !== 'noun') {
    item.gender = null;
    item.plural_form = null;
  }

  // 2. Fix identical, empty, pseudo-meaning, or naive fake stem meanings
  const rawWord = String(item.word || '').trim();
  const cleanWord = rawWord.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
  const rawMeaning = String(item.meaning || '').trim().toLowerCase();

  const isMeaningCorrupted =
    !rawMeaning ||
    rawMeaning === cleanWord ||
    rawMeaning === rawWord.toLowerCase() ||
    rawMeaning === 'to dank' ||
    rawMeaning === 'to heiß' ||
    rawMeaning === 'to heiss' ||
    rawMeaning.includes('to (verb)') ||
    (rawMeaning.startsWith('to ') && rawMeaning.slice(3).trim() === (cleanWord.endsWith('en') ? cleanWord.slice(0, -2) : '')) ||
    (cleanWord === 'es geht' && (rawMeaning === 'es geht' || pos === 'adjective'));

  if (isMeaningCorrupted) {
    const dict = lookupWord(cleanWord) || lookupWord(rawWord);
    if (dict) {
      item.meaning = dict.meaning;
      if (dict.partOfSpeech) item.part_of_speech = dict.partOfSpeech;
      if (dict.presentForm && !item.present_form) item.present_form = dict.presentForm;
      if (dict.simplePast && !item.simple_past) item.simple_past = dict.simplePast;
      if (dict.perfectForm && !item.perfect_form) item.perfect_form = dict.perfectForm;
      if (dict.conjugation && !item.conjugation) item.conjugation = dict.conjugation;
      if (!item.example_sentence || String(item.example_sentence).includes('Das ist ') || String(item.example_sentence).includes('Ich möchte gerne ') || String(item.example_sentence).includes('Wir müssen heute')) {
        item.example_sentence = dict.exampleSentence;
      }
    } else if (rawMeaning.includes('to (verb)')) {
      item.meaning = rawMeaning.replace(/to \(verb\)\s*[–-]\s*/gi, 'to ').replace(/to \(verb\)/gi, '').trim();
    }
  }

  // 3. Fix placeholder example sentences
  if (
    typeof item.example_sentence === 'string' &&
    (
      item.example_sentence.includes('zusammen.') ||
      item.example_sentence.includes('Das ist sehr') ||
      item.example_sentence.includes('Wir müssen heute') ||
      item.example_sentence.includes('Wir verwenden den Ausdruck') ||
      item.example_sentence.startsWith(`Das ist ${rawWord}`) ||
      item.example_sentence.startsWith(`Das ist ${cleanWord}`) ||
      item.example_sentence.startsWith(`Ich möchte gerne ${rawWord}`) ||
      item.example_sentence.startsWith(`Ich möchte gerne ${cleanWord}`) ||
      item.example_sentence.includes('Das ist es geht')
    )
  ) {
    const dict = lookupWord(cleanWord) || lookupWord(rawWord);
    if (dict?.exampleSentence) {
      item.example_sentence = dict.exampleSentence;
    }
  }

  // 4. Ensure spelling correction and noun articles from dictionary canonical forms
  const dictMatch = lookupWord(cleanWord) || lookupWord(rawWord);
  if (dictMatch?.canonicalWord) {
    if (pos === 'noun' || dictMatch.partOfSpeech === 'noun') {
      item.word = dictMatch.canonicalWord;
      item.part_of_speech = 'noun';
      if (dictMatch.gender) item.gender = dictMatch.gender;
      if (dictMatch.pluralForm && !item.plural_form) item.plural_form = dictMatch.pluralForm;
    } else if (pos === 'verb' && dictMatch.partOfSpeech === 'verb') {
      item.word = dictMatch.canonicalWord;
      if (dictMatch.presentForm && !item.present_form) item.present_form = dictMatch.presentForm;
      if (dictMatch.simplePast && !item.simple_past) item.simple_past = dictMatch.simplePast;
      if (dictMatch.perfectForm && !item.perfect_form) item.perfect_form = dictMatch.perfectForm;
      if (dictMatch.conjugation && !item.conjugation) item.conjugation = dictMatch.conjugation;
    }
  }
}

function parseEnrichWordResponse(raw: string | null | undefined): EnrichedWord[] {
  if (!raw) {
    console.error('[AI:enrichWords] Empty raw response');
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const wordsArray =
      parsed.words ?? parsed.Words ?? parsed.WORDS ??
      (Array.isArray(parsed) ? parsed : null);

    if (!wordsArray || !Array.isArray(wordsArray)) {
      console.error('[AI:enrichWords] No words array found. Keys:', Object.keys(parsed));
      return [];
    }

    // Sanitize before validation
    for (const item of wordsArray) {
      sanitizeEnrichedItem(item);
    }

    const batchResult = enrichedWordsResponseSchema.safeParse({ words: wordsArray });
    if (batchResult.success) {
      return batchResult.data.words;
    }

    console.warn('[AI:enrichWords] Batch validation failed, salvaging individual words...');
    const salvaged: EnrichedWord[] = [];
    for (const item of wordsArray) {
      const single = enrichedWordSchema.safeParse(item);
      if (single.success) {
        salvaged.push(single.data);
      } else {
        console.error('[AI:enrichWords] Skipped word issue:', single.error.issues);
      }
    }
    return salvaged;
  } catch (err) {
    console.error('[AI:enrichWords] JSON parse error:', err, 'Raw response:', raw.slice(0, 300));
    return [];
  }
}

function reconcileWordBatch(words: string[], parsed: EnrichedWord[]): EnrichedWord[] {
  if (parsed.length === words.length) {
    return parsed;
  }

  const result: EnrichedWord[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    const root = normalizeWord(rawWord);

    // Try finding matching item by root
    let matchIdx = parsed.findIndex((p, idx) => {
      if (usedIndices.has(idx)) return false;
      const pRoot = normalizeWord(p.word);
      return pRoot === root || pRoot.includes(root) || root.includes(pRoot);
    });

    // If no root match and position i is unused and exists, match by position
    if (matchIdx === -1 && i < parsed.length && !usedIndices.has(i)) {
      matchIdx = i;
    }

    if (matchIdx !== -1) {
      usedIndices.add(matchIdx);
      result.push(parsed[matchIdx]);
    } else {
      console.warn(`[AI:reconcileWordBatch] Word "${rawWord}" was missing from AI output, applying dictionary/fallback`);
      result.push(fallbackEnrichWord(rawWord));
    }
  }

  return result;
}

async function enrichWordBatch(words: string[]): Promise<EnrichedWord[]> {
  const listPrompt = words.map((w, i) => `${i + 1}. ${w}`).join('\n');
  const prompt = `Provide linguistic data with spelling corrections for each of these German words/phrases (return exactly ${words.length} items, one per numbered entry in the same order):\n${listPrompt}`;

  // 1. Primary AI: Google Gemini premier model cascade (gemini-3.8-flash, etc.)
  if (isGeminiConfigured()) {
    try {
      const rawResponse = await callGemini({
        systemInstruction: ENRICH_WORD_SYSTEM_PROMPT,
        prompt,
        temperature: 0.1,
        responseMimeType: 'application/json',
      });

      const parsed = parseEnrichWordResponse(rawResponse);
      if (parsed.length > 0) {
        return reconcileWordBatch(words, parsed);
      }
    } catch (err) {
      console.warn('[AI:enrichWordBatch] Gemini call failed, trying Groq fallback:', err);
    }
  }

  // 2. Secondary AI: Groq high-tier model cascade (120B / 27B)
  if (getGroqApiKey()) {
    try {
      const rawGroq = await callGroqFallback({
        systemInstruction: ENRICH_WORD_SYSTEM_PROMPT,
        prompt,
        temperature: 0.1,
      });

      const parsedGroq = parseEnrichWordResponse(rawGroq);
      if (parsedGroq.length > 0) {
        return reconcileWordBatch(words, parsedGroq);
      }
    } catch (groqErr) {
      console.warn('[AI:enrichWordBatch] Groq fallback failed:', groqErr);
    }
  }

  // 3. Tertiary: Local dictionary fallback (with 300+ Goethe words)
  return words.map(fallbackEnrichWord);
}

/**
 * Enriches German words with premier AI models (gender, articles, CEFR level, conjugations, examples).
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

  console.log(`[AI:enrichWords] Processing ${words.length} words across ${chunks.length} batches`);
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

  console.log(`[AI:enrichWords] Enriched ${allResults.length}/${words.length} words`);
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

  // Check dictionary
  const dict = lookupWord(trimmed);

  return {
    expression: trimmed,
    meaning: dict?.meaning ?? trimmed,
    literal_translation: null,
    register: 'neutral',
    cefr_level: dict?.cefrLevel ?? 'A1',
    example_sentence: dict?.exampleSentence ?? `Wir verwenden den Ausdruck: "${trimmed}".`,
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
    console.error('[AI:enrichExpressions] Parse error:', err);
    return [];
  }
}

async function enrichExpressionBatch(expressions: string[]): Promise<EnrichedExpression[]> {
  const listPrompt = expressions.map((e, i) => `${i + 1}. ${e}`).join('\n');
  const prompt = `Provide linguistic data for each of these German fixed expressions (one entry per item):\n${listPrompt}`;

  // 1. Primary AI: Gemini
  if (isGeminiConfigured()) {
    try {
      const rawResponse = await callGemini({
        systemInstruction: ENRICH_EXPRESSION_SYSTEM_PROMPT,
        prompt,
        temperature: 0.1,
        responseMimeType: 'application/json',
      });

      const parsed = parseEnrichExpressionResponse(rawResponse);
      if (parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('[AI:enrichExpressionBatch] Gemini failed, trying Groq fallback:', err);
    }
  }

  // 2. Secondary AI: Groq
  if (getGroqApiKey()) {
    try {
      const rawGroq = await callGroqFallback({
        systemInstruction: ENRICH_EXPRESSION_SYSTEM_PROMPT,
        prompt,
        temperature: 0.1,
      });

      const parsedGroq = parseEnrichExpressionResponse(rawGroq);
      if (parsedGroq.length > 0) {
        return parsedGroq;
      }
    } catch (groqErr) {
      console.warn('[AI:enrichExpressionBatch] Groq failed:', groqErr);
    }
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
