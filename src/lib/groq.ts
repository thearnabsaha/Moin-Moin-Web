import Groq from 'groq-sdk';
import {
  enrichedWordSchema,
  enrichedWordsResponseSchema,
  enrichedExpressionSchema,
  enrichedExpressionsResponseSchema,
  chatResponseSchema,
  type EnrichedWord,
  type EnrichedExpression,
  type ChatResponse,
} from './validations';
import {
  enrichWordsWithGemini,
  enrichExpressionsWithGemini,
  isGeminiConfigured,
  fallbackEnrichWord,
} from './gemini';

let groqInstance: Groq | null = null;

function getGroq(): Groq {
  if (!groqInstance) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    groqInstance = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqInstance;
}

// ── MODEL CASCADE ────────────────────────────────────────────
// Ordered by speed, reliability, and rate-limit resilience on Groq.
const MODEL_CASCADE = [
  'openai/gpt-oss-safeguard-20b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'groq/compound-mini',
  'openai/gpt-oss-120b',
  'groq/compound',
  'allam-2-7b',
] as const;

interface CallGroqParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

function isRetryableError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; statusCode?: number; error?: { type?: string }; message?: string };
    if (e.status === 429 || e.statusCode === 429) return true;
    if (e.status === 503 || e.statusCode === 503) return true;
    if (e.status === 500 || e.statusCode === 500) return true;
    if (e.status === 404 || e.statusCode === 404) return true;
    if (e.status === 400 || e.statusCode === 400) return true;
    if (e.error?.type === 'rate_limit_exceeded') return true;
    if (typeof e.message === 'string' && /rate.?limit|429|too many|quota|capacity|not found|decommissioned|not exist|timeout/i.test(e.message)) return true;
  }
  return false;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls Groq chat completions with automatic model fallback and per-model timeout.
 */
export async function callGroq(
  params: CallGroqParams,
  opts?: { preferredModel?: string; timeoutMs?: number }
) {
  const groq = getGroq();
  const startIdx = opts?.preferredModel
    ? Math.max(0, MODEL_CASCADE.indexOf(opts.preferredModel as typeof MODEL_CASCADE[number]))
    : 0;

  const timeoutMs = opts?.timeoutMs ?? 10_000;
  let lastError: unknown;

  for (let mi = startIdx; mi < MODEL_CASCADE.length; mi++) {
    const model = MODEL_CASCADE[mi];

    try {
      // Per-model race against timeout
      const completion = await Promise.race([
        groq.chat.completions.create({
          ...params,
          model,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      return completion;
    } catch (err: unknown) {
      lastError = err;
      if (isRetryableError(err)) {
        console.warn(`[Groq] Error/timeout on ${model}, falling back to next model...`);
        await sleep(200);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('All Groq models exhausted');
}

// ── WRITING GRADING ──────────────────────────────────────────

interface GradeWritingParams {
  cefrLevel: string;
  prompt: string;
  response: string;
}

interface WritingGrade {
  score: number;
  maxScore: number;
  taskAchievement: { score: number; feedback: string };
  coherence: { score: number; feedback: string };
  vocabulary: { score: number; feedback: string };
  grammar: { score: number; feedback: string };
  overallFeedback: string;
  corrections: Array<{ original: string; corrected: string; explanation: string }>;
}

export async function gradeWriting(params: GradeWritingParams): Promise<WritingGrade> {
  const completion = await callGroq({
    messages: [
      {
        role: 'system',
        content: `You are a certified Goethe-Institut examiner grading a ${params.cefrLevel} Schreiben (Writing) submission. Grade strictly according to CEFR ${params.cefrLevel} rubrics across four criteria: Task Achievement (25pts), Coherence & Cohesion (25pts), Vocabulary Range (25pts), Grammar Accuracy (25pts). Total max: 100. Return ONLY valid JSON with this exact structure:
{
  "score": <total>,
  "maxScore": 100,
  "taskAchievement": {"score": <0-25>, "feedback": "<specific feedback>"},
  "coherence": {"score": <0-25>, "feedback": "<specific feedback>"},
  "vocabulary": {"score": <0-25>, "feedback": "<specific feedback>"},
  "grammar": {"score": <0-25>, "feedback": "<specific feedback>"},
  "overallFeedback": "<2-3 sentences summarizing strengths and areas for improvement>",
  "corrections": [{"original": "<incorrect phrase>", "corrected": "<correct version>", "explanation": "<brief explanation in English>"}]
}`,
      },
      {
        role: 'user',
        content: `Prompt: ${params.prompt}\n\nStudent's response:\n${params.response}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Groq');

  try {
    return JSON.parse(raw) as WritingGrade;
  } catch {
    throw new Error('Invalid JSON response from Groq');
  }
}

// ── SPEAKING CONVERSATION ────────────────────────────────────

interface SpeakingMessage {
  role: 'examiner' | 'candidate';
  content: string;
}

export async function speakingConversation(
  cefrLevel: string,
  task: string,
  history: SpeakingMessage[],
  userMessage: string
): Promise<string> {
  const messages: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [
    {
      role: 'system',
      content: `You are a Goethe-Institut oral examiner conducting a ${cefrLevel} Sprechen (Speaking) exam. The current task: "${task}". Speak in German appropriate for ${cefrLevel} level. Ask follow-up questions, keep the conversation natural. If the candidate makes errors, do NOT correct them mid-conversation—just continue naturally. Keep responses concise (2-3 sentences max). Respond ONLY in German.`,
    },
    ...history.map((m) => ({
      role: (m.role === 'examiner' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const completion = await callGroq({
    messages,
    temperature: 0.7,
    max_tokens: 300,
  });

  return completion.choices[0]?.message?.content ?? 'Können Sie das bitte wiederholen?';
}

// ── GRAMMAR EXPLANATION ──────────────────────────────────────

export async function explainGrammar(
  sentence: string,
  error: string,
  cefrLevel: string
): Promise<string> {
  const completion = await callGroq({
    messages: [
      {
        role: 'system',
        content: `You are a German language tutor explaining grammar concepts at the ${cefrLevel} level. Use the Elaborative Interrogation technique: explain WHY the grammar rule works the way it does, connecting it to patterns the learner already knows. Be concise but thorough. Use both German examples and English explanations.`,
      },
      {
        role: 'user',
        content: `In this sentence: "${sentence}"\nI got this wrong: "${error}"\nExplain why the correct answer is what it is and help me understand the underlying grammar rule.`,
      },
    ],
    temperature: 0.4,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content ?? 'Unable to generate explanation.';
}

// ── WORD ENRICHMENT ──────────────────────────────────────────

const ENRICH_SYSTEM_PROMPT = `You are a German language lexicography expert. For each German word or phrase provided, return structured linguistic data.

CRITICAL RULES for interpreting input:
- If the user writes an article + noun (e.g. "die Frau", "der Hund", "das Kind"), treat it as ONE noun entry. The article indicates the gender. The "word" field should be the noun with its article (e.g. "die Frau").
- If the user writes a BARE noun WITHOUT an article (e.g. "Frau", "Hund", "Kind", "Tisch"), you MUST still return the word field WITH its correct definite article prepended (e.g. "Frau" → word: "die Frau", "Hund" → word: "der Hund", "Kind" → word: "das Kind"). Always add the correct article for nouns.
- If the user writes a reflexive verb (e.g. "sich freuen", "sich setzen"), treat it as ONE verb entry.
- Multi-word expressions (e.g. "auf Wiedersehen", "zum Beispiel", "Guten Morgen") should be treated as ONE entry.
- Separable prefix verbs (e.g. "aufstehen", "ankommen") are single verbs.
- NEVER split an article+noun, reflexive pronoun+verb, or multi-word phrase into separate entries.
- Return exactly one entry per numbered input item provided by the user.

Return ONLY valid JSON matching this structure: { words: [{ word, part_of_speech (noun/verb/adjective/adverb/preposition/conjunction/pronoun/article/other), gender (masculine/feminine/neuter or null if not noun), plural_form (or null if not noun), conjugation (object with ich/du/er/wir/ihr/sie keys or null if not verb, present tense), meaning (English translation), cefr_level (A1/A2/B1/B2), example_sentence (simple German sentence using the word), verb_type (regular/irregular/mixed or null if not verb), auxiliary_type (haben/sein or null if not verb), present_form (3rd person singular present or null if not verb), simple_past (3rd person singular past or null if not verb), perfect_form (perfect tense with auxiliary e.g. "hat gemacht" or "ist gegangen", or null if not verb) }] }`;

const ENRICH_BATCH_SIZE = 10;
const MAX_CONCURRENT_BATCHES = 2;

function parseEnrichResponse(raw: string | null | undefined): EnrichedWord[] {
  if (!raw) {
    console.error('[enrichWords] Empty response from Groq');
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    const wordsArray =
      parsed.words ?? parsed.Words ?? parsed.WORDS ??
      (Array.isArray(parsed) ? parsed : null);

    if (!wordsArray || !Array.isArray(wordsArray)) {
      console.error('[enrichWords] No words array found in response. Keys:', Object.keys(parsed));
      return [];
    }

    const result = enrichedWordsResponseSchema.safeParse({ words: wordsArray });
    if (result.success) return result.data.words;

    console.error('[enrichWords] Batch validation failed, trying individual words...');
    const salvaged: EnrichedWord[] = [];
    for (const item of wordsArray) {
      const single = enrichedWordSchema.safeParse(item);
      if (single.success) {
        salvaged.push(single.data);
      } else {
        console.error('[enrichWords] Skipped word:', item?.word ?? JSON.stringify(item).slice(0, 80), single.error.issues.map((i: { message: string }) => i.message).join(', '));
      }
    }
    return salvaged;
  } catch (err) {
    console.error('[enrichWords] JSON parse error:', err, 'Raw response:', (raw ?? '').slice(0, 500));
    return [];
  }
}

export { fallbackEnrichWord };

async function enrichBatch(words: string[]): Promise<EnrichedWord[]> {
  try {
    const wordsList = words.map((w, i) => `${i + 1}. ${w}`).join('\n');

    const completion = await callGroq({
      messages: [
        { role: 'system', content: ENRICH_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Provide linguistic data for each of these German words/phrases (one entry per item):\n${wordsList}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const parsed = parseEnrichResponse(completion.choices[0]?.message?.content);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('[enrichBatch] Groq call failed, using fallback enrichment:', err);
  }

  // Guaranteed fallback for every word
  return words.map(fallbackEnrichWord);
}

export async function enrichWords(words: string[]): Promise<EnrichedWord[]> {
  if (isGeminiConfigured()) {
    try {
      return await enrichWordsWithGemini(words);
    } catch (geminiErr) {
      console.warn('[enrichWords] Gemini enrichment failed, falling back to Groq cascade:', geminiErr);
    }
  }

  if (words.length <= ENRICH_BATCH_SIZE) {
    return enrichBatch(words);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += ENRICH_BATCH_SIZE) {
    chunks.push(words.slice(i, i + ENRICH_BATCH_SIZE));
  }

  console.log(`[enrichWords] Processing ${words.length} words in ${chunks.length} batches`);

  const allResults: EnrichedWord[] = [];

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
    const concurrentChunks = chunks.slice(i, i + MAX_CONCURRENT_BATCHES);
    const batchResults = await Promise.allSettled(
      concurrentChunks.map((chunk) => enrichBatch(chunk))
    );

    for (let idx = 0; idx < batchResults.length; idx++) {
      const result = batchResults[idx];
      if (result && result.status === 'fulfilled' && result.value.length > 0) {
        allResults.push(...result.value);
      } else {
        const failedChunk = concurrentChunks[idx];
        if (failedChunk) {
          allResults.push(...failedChunk.map(fallbackEnrichWord));
        }
      }
    }
  }

  console.log(`[enrichWords] Enriched ${allResults.length}/${words.length} words successfully`);
  return allResults;
}

// ── EXPRESSION ENRICHMENT ────────────────────────────────────

const ENRICH_EXPRESSION_SYSTEM_PROMPT = `You are a German language expert specializing in fixed expressions, idioms, and collocations. For each German fixed expression or phrase provided, return structured data.

CRITICAL RULES:
- Treat each input as a single fixed expression (idiom, collocation, greeting, proverb, filler word/phrase, connector phrase, etc.)
- NEVER split a multi-word expression into separate entries.
- Return exactly one entry per numbered input item provided by the user.
- The "expression" field must contain the full expression as typically used.

Return ONLY valid JSON matching this structure: { expressions: [{ expression, meaning (English translation/explanation), literal_translation (word-for-word English translation or null if same as meaning), register (formal/informal/neutral/colloquial/slang or null), cefr_level (A1/A2/B1/B2), example_sentence (simple German sentence using the expression), usage_note (when/how to use it, or null), category (greeting/farewell/polite/idiom/collocation/proverb/filler/connector/other) }] }`;

function parseEnrichExpressionResponse(raw: string | null | undefined): EnrichedExpression[] {

  if (!raw) {
    console.error('[enrichExpressions] Empty response from Groq');
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const expressionsArray =
      parsed.expressions ?? parsed.Expressions ?? parsed.EXPRESSIONS ??
      (Array.isArray(parsed) ? parsed : null);

    if (!expressionsArray || !Array.isArray(expressionsArray)) {
      console.error('[enrichExpressions] No expressions array found in response. Keys:', Object.keys(parsed));
      return [];
    }

    const result = enrichedExpressionsResponseSchema.safeParse({ expressions: expressionsArray });
    if (result.success) return result.data.expressions;

    console.error('[enrichExpressions] Batch validation failed, trying individual...');
    const salvaged: EnrichedExpression[] = [];
    for (const item of expressionsArray) {
      const single = enrichedExpressionSchema.safeParse(item);
      if (single.success) {
        salvaged.push(single.data);
      } else {
        console.error('[enrichExpressions] Skipped:', item?.expression ?? JSON.stringify(item).slice(0, 80));
      }
    }
    return salvaged;
  } catch (err) {
    console.error('[enrichExpressions] JSON parse error:', err);
    return [];
  }
}

async function enrichExpressionBatch(expressions: string[]): Promise<EnrichedExpression[]> {
  const list = expressions.map((e, i) => `${i + 1}. ${e}`).join('\n');

  const completion = await callGroq({
    messages: [
      { role: 'system', content: ENRICH_EXPRESSION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Provide linguistic data for each of these German fixed expressions (one entry per item):\n${list}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  return parseEnrichExpressionResponse(completion.choices[0]?.message?.content);
}

export async function enrichExpressions(expressions: string[]): Promise<EnrichedExpression[]> {
  if (isGeminiConfigured()) {
    try {
      return await enrichExpressionsWithGemini(expressions);
    } catch (geminiErr) {
      console.warn('[enrichExpressions] Gemini enrichment failed, falling back to Groq cascade:', geminiErr);
    }
  }

  if (expressions.length <= ENRICH_BATCH_SIZE) {
    return enrichExpressionBatch(expressions);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < expressions.length; i += ENRICH_BATCH_SIZE) {
    chunks.push(expressions.slice(i, i + ENRICH_BATCH_SIZE));
  }

  console.log(`[enrichExpressions] Processing ${expressions.length} expressions in ${chunks.length} batches`);

  const allResults: EnrichedExpression[] = [];

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
    const concurrentChunks = chunks.slice(i, i + MAX_CONCURRENT_BATCHES);
    const batchResults = await Promise.allSettled(
      concurrentChunks.map((chunk) => enrichExpressionBatch(chunk))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        console.error('[enrichExpressions] Batch failed:', result.reason);
      }
    }
  }

  console.log(`[enrichExpressions] Enriched ${allResults.length}/${expressions.length} expressions successfully`);
  return allResults;
}

// ── CHAT WITH CORRECTIONS ────────────────────────────────────

export async function chatWithCorrections(
  cefrLevel: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<ChatResponse> {
  const messages: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [
    {
      role: 'system',
      content: `You are a friendly German conversation partner at the ${cefrLevel} level. Respond naturally in German. You must return ONLY valid JSON: { reply: (your German response, 2-3 sentences), translation: (English translation of your reply), corrections: [{ original: (user's mistake), corrected: (correct form), rule: (brief grammar rule explanation) }] }. If the user made no mistakes, corrections should be empty array.`,
    },
    ...history.map((m) => ({
      role: m.role as 'assistant' | 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const completion = await callGroq({
    messages,
    temperature: 0.6,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return { reply: 'Entschuldigung, ich konnte nicht antworten.', translation: 'Sorry, I could not respond.', corrections: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    const result = chatResponseSchema.safeParse(parsed);
    if (result.success) return result.data;
    return { reply: raw, translation: '', corrections: [] };
  } catch {
    return { reply: raw, translation: '', corrections: [] };
  }
}

// ── AI INSIGHTS ──────────────────────────────────────────────

interface GenerateInsightsData {
  totalReviews: number;
  correctRate: number;
  weakAreas: string[];
  examScores: Array<{ section: string; score: number }>;
}

interface InsightsResult {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export async function generateInsights(data: GenerateInsightsData): Promise<InsightsResult> {
  const fallback: InsightsResult = {
    strengths: ['Consistent practice'],
    weaknesses: ['Continue identifying weak areas through more exercises'],
    recommendations: ['Review weak areas regularly', 'Practice with varied exercises'],
  };

  const completion = await callGroq({
    messages: [
      {
        role: 'system',
        content: `You are a German learning coach. Analyze the learner's data and return ONLY valid JSON: { strengths: [string array of 2-4 strengths], weaknesses: [string array of 2-4 areas to improve], recommendations: [string array of 2-4 actionable study recommendations] }.`,
      },
      {
        role: 'user',
        content: `Analyze this learner data and provide insights:
- Total reviews completed: ${data.totalReviews}
- Correct answer rate: ${(data.correctRate * 100).toFixed(1)}%
- Weak areas: ${data.weakAreas.join(', ') || 'None specified'}
- Exam scores by section: ${JSON.stringify(data.examScores)}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : fallback.strengths;
    const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : fallback.weaknesses;
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : fallback.recommendations;
    return { strengths, weaknesses, recommendations };
  } catch {
    return fallback;
  }
}

// ── PRACTICE QUESTION GENERATION ──────────────────────────────

export interface GenerateQuestionParams {
  wordId: string;
  word: string;
  meaning: string;
  partOfSpeech: string;
  gender?: string | null;
  conjugation?: Record<string, string> | null;
  pluralForm?: string | null;
  questionType: string;
  direction: string;
}

export interface GenerateQuestionResult {
  question: string;
  correct_answer: string;
  explanation?: string;
}

export async function generatePracticeQuestion(
  params: GenerateQuestionParams
): Promise<GenerateQuestionResult> {
  const context = [
    `Word: ${params.word}`,
    `Meaning: ${params.meaning}`,
    `Part of speech: ${params.partOfSpeech}`,
    params.gender ? `Gender: ${params.gender}` : null,
    params.pluralForm ? `Plural form: ${params.pluralForm}` : null,
    params.conjugation ? `Conjugation: ${JSON.stringify(params.conjugation)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const completion = await callGroq({
    messages: [
      {
        role: 'system',
        content: `You are a German language tutor creating practice questions. Given word data, generate ONE practice question. Return ONLY valid JSON: { question: (the prompt shown to the user), correct_answer: (exact expected answer), explanation: (optional brief explanation) }. Question types: meaning (translate), gender (der/die/das), plural, verb (conjugation), fill_blank. Direction: de_to_en (German→English), en_to_de (English→German), both.`,
      },
      {
        role: 'user',
        content: `Generate a ${params.questionType} question with direction ${params.direction} for:\n${context}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response');

  try {
    const parsed = JSON.parse(raw);
    return {
      question: parsed.question || params.word,
      correct_answer: parsed.correct_answer || params.meaning,
      explanation: parsed.explanation,
    };
  } catch {
    return {
      question: params.word,
      correct_answer: params.meaning,
    };
  }
}

// ── LISTENING EXERCISE GENERATION ────────────────────────────

export async function generateListeningExercise(
  cefrLevel: string,
  difficulty: string,
  userVocabulary: string[],
  maxNewWords: number = 2,
): Promise<import('./validations').ListeningExercise> {
  const { listeningExerciseSchema } = await import('./validations');

  const vocabSample = userVocabulary.length > 30
    ? userVocabulary.sort(() => Math.random() - 0.5).slice(0, 30)
    : userVocabulary;

  const difficultyInstructions: Record<string, string> = {
    very_easy: 'Use very short, simple sentences (2-3 sentences total). Basic present tense only. Direct, clear statements. All vocabulary should be from the user list.',
    easy: 'Use short sentences (3-4 sentences). Simple grammar. Clear pronunciation-friendly text. Mostly user vocabulary with max 1 new word.',
    normal: 'Use moderate-length text (4-6 sentences). Mix of tenses allowed. Natural conversation flow. Max 1-2 new words beyond user vocabulary.',
    hard: 'Use longer text (5-7 sentences). Complex sentence structures, subordinate clauses. Indirect speech. Max 2 new words. Include some idiomatic expressions.',
    very_hard: 'Use complex dialogue or monologue (6-8 sentences). Advanced grammar, subjunctive mood, passive voice. Indirect questions. Nuanced meaning. Include 2 potentially confusing new words. Add trick options in questions.',
  };

  const questionInstructions: Record<string, string> = {
    A1: 'Ask 3 simple factual questions. Direct answers found in text. All MCQ with 3 options.',
    A2: 'Ask 3-4 questions. Mix of direct factual and slight inference. MCQ with 3-4 options.',
    B1: 'Ask 4 questions. Include indirect meaning and purpose-based questions. MCQ with 4 options.',
    B2: 'Ask 4-5 questions. Include opinion, implication, and reasoning questions. Mix of MCQ (4 options) and 1 short-answer question.',
  };

  const prompt = `Generate a German listening exercise at CEFR level ${cefrLevel}.

User's known vocabulary: ${vocabSample.join(', ')}

Difficulty: ${difficulty}
${difficultyInstructions[difficulty] || difficultyInstructions['normal']}

Question requirements for ${cefrLevel}:
${questionInstructions[cefrLevel] || questionInstructions['A1']}

Return JSON:
{
  "level": "${cefrLevel}",
  "script": "The German text/dialogue to be read aloud...",
  "new_words_used": ["any", "new", "words"],
  "questions": [
    {
      "question": "Question in German",
      "options": ["Option A", "Option B", "Option C"],
      "correct_index": 0,
      "explanation": "Explanation in English of why this is correct",
      "type": "mcq"
    }
  ]
}

IMPORTANT:
- Script MUST be in German
- Questions MUST be in German  
- Options MUST be in German
- Explanations in English
- Use ONLY words from the user's vocabulary list, with a MAXIMUM of ${maxNewWords} new word(s) not in the list
- Keep grammar appropriate to ${cefrLevel} level
- new_words_used must list ONLY words NOT in the user's vocabulary
- For short_answer type questions, put the correct answer as options[0] and set correct_index to 0`;

  const completion = await callGroq({
    messages: [
      { role: 'system', content: 'You are a German language exam creator specializing in Goethe-Institut style listening comprehension exercises. Return ONLY valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('No AI response for listening exercise');

  const parsed = JSON.parse(raw);
  const result = listeningExerciseSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Listening exercise validation failed:', result.error);
    throw new Error('Invalid listening exercise format');
  }

  return result.data;
}
