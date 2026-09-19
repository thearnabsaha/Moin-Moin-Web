/**
 * German Word Parser and Normalizer
 * Handles messy user input (numbering, bullets, translations, punctuation)
 * and guarantees deduplication ("repeated words shouldn't come").
 */

/**
 * Normalizes a German word to its root form for robust comparison and deduplication.
 * - Lowercases
 * - Removes articles (der, die, das, dem, den, des, ein, eine, etc.)
 * - Removes reflexive pronoun (sich)
 * - Removes punctuation and whitespace
 */
export function normalizeWord(word: string): string {
  if (!word || typeof word !== 'string') return '';
  return word
    .toLowerCase()
    .trim()
    .replace(/^(der|die|das|dem|den|des|ein|eine|einen|einem|einer|eines)\s+/i, '')
    .replace(/^(sich)\s+/i, '')
    .replace(/[^a-z0-9äöüß]/gi, '')
    .trim();
}

/**
 * Parses raw user input into an array of clean, unique German words/phrases.
 * 
 * Handles:
 * - Numbered lists ("1. der Hund", "2) das Buch", "[3] die Katze")
 * - Bulleted lists ("- das Haus", "• der Tisch", "* die Lampe")
 * - German-English glosses ("das Haus - the house", "gehen : to go", "fahren = drive")
 * - Parenthetical translations/notes ("das Haus (house)", "der Apfel (apple)")
 * - Multiple delimiters (newlines, commas, semicolons, tabs, pipes, slashes)
 * - Repeated words (deduplicates preserving the best version with article/capitalization)
 */
export function parseAndCleanWords(input: string): string[] {
  if (!input || typeof input !== 'string') return [];

  // 1. Split input by newlines first
  const rawLines = input.split(/[\r\n]+/);
  const candidateSegments: string[] = [];

  for (const line of rawLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Split line by comma, semicolon, tab, or pipe
    const parts = trimmedLine.split(/[,;\t|]+/);
    for (const part of parts) {
      const p = part.trim();
      if (p) candidateSegments.push(p);
    }
  }

  // 2. Clean each segment and deduplicate
  const seenRoots = new Map<string, { word: string; hasArticle: boolean; isCapitalized: boolean }>();

  for (const segment of candidateSegments) {
    let text = segment.trim();

    // Remove leading numbering or list markers:
    // e.g. "1.", "1)", "(1)", "[1]", "#1", "•", "-", "*", "–", "—", "›", ">"
    text = text.replace(/^(\d+[.)\-/:\]]|[\-*•+–—›>[\](]\s*|\(\d+\)\s*|\[\d+\]\s*|#\d+\s*)+/g, '').trim();

    // Remove surrounding quotes or backticks
    text = text.replace(/^["'„“«»`]+|["'„“«»`]+$/g, '').trim();

    // If there is an English gloss separated by " - ", ":", " = ", extract German term:
    // e.g. "das Haus - the house" -> "das Haus"
    // e.g. "schlafen: to sleep" -> "schlafen"
    const glossMatch = text.match(/^([^-:=–—]+?)\s*[-:=–—]\s*(.+)$/);
    if (glossMatch && glossMatch[1].trim()) {
      text = glossMatch[1].trim();
    }

    // If there are parenthetical notes at the end e.g. "das Buch (book)", remove them
    // But keep "(der) Hund" by converting to "der Hund"
    text = text.replace(/^\((der|die|das)\)\s+/i, '$1 ');
    text = text.replace(/\s*\([^)]*\)$/, '').trim();

    // Remove trailing punctuation (. , ; : ! ?)
    text = text.replace(/[.,;:!?]+$/g, '').trim();

    // Collapse multiple whitespace
    text = text.replace(/\s+/g, ' ').trim();

    if (!text || text.length === 0) continue;

    const root = normalizeWord(text);
    if (!root) continue;

    const hasArticle = /^(der|die|das)\s+/i.test(text);
    const isCapitalized = /^[A-ZÄÖÜ]/.test(hasArticle ? text.replace(/^(der|die|das)\s+/i, '') : text);

    // Deduplication check ("repeated words shouldn't come")
    if (seenRoots.has(root)) {
      const existing = seenRoots.get(root)!;
      // Upgrade to the version with the article or proper capitalization if current is better
      if (!existing.hasArticle && hasArticle) {
        seenRoots.set(root, { word: text, hasArticle: true, isCapitalized });
      } else if (!existing.isCapitalized && isCapitalized && (!existing.hasArticle || hasArticle)) {
        seenRoots.set(root, { word: text, hasArticle: existing.hasArticle || hasArticle, isCapitalized: true });
      }
    } else {
      seenRoots.set(root, { word: text, hasArticle, isCapitalized });
    }
  }

  return Array.from(seenRoots.values()).map((v) => v.word);
}

/**
 * Validates if an existing vocabulary item in the database has valid linguistic data,
 * or if it was corrupted by a past naive fallback (e.g. "to dank", "to heiß", "es geht" as adjective).
 */
export function isCorruptedWordData(
  word: string,
  meaning?: string | null,
  exampleSentence?: string | null,
  partOfSpeech?: string | null
): boolean {
  if (!meaning || !meaning.trim()) return true;
  const m = meaning.trim().toLowerCase();
  const w = word.trim().toLowerCase();
  const cleanW = w.replace(/^(der|die|das)\s+/i, '').trim();

  // 1. Meaning equals the word itself (excluding true German-English cognates like hand, finger, arm, oh, sing)
  const COGNATES = new Set(['hand', 'finger', 'arm', 'ball', 'bus', 'hotel', 'park', 'radio', 'taxi', 'film', 'baby', 'start', 'stop', 'test', 'winter', 'super', 'gras', 'wind', 'ring', 'gold', 'glas', 'wolf', 'rose', 'tiger', 'oh', 'sing']);
  if ((m === w || m === cleanW) && !COGNATES.has(cleanW)) return true;

  // 2. Known naive stem strings
  if (m === 'to dank' || m === 'to heiß' || m === 'to heiss') return true;

  // 3. Naive "to <german_stem>" fallback patterns
  if (m.startsWith('to ')) {
    const stem = cleanW.endsWith('en') ? cleanW.slice(0, -2) : cleanW.endsWith('eln') || cleanW.endsWith('ern') ? cleanW.slice(0, -1) : cleanW;
    const meaningWord = m.slice(3).trim();
    if ((meaningWord === stem || meaningWord === cleanW) && !COGNATES.has(stem) && !COGNATES.has(meaningWord)) return true;
  }

  // 4. "es geht" misclassified as adjective or meaning "es geht"
  if (cleanW === 'es geht' && (m === 'es geht' || partOfSpeech === 'adjective')) {
    return true;
  }

  // 5. Fallback dummy sentences
  if (exampleSentence) {
    if (exampleSentence === `Das ist ${w}.` || exampleSentence === `Das ist ${cleanW}.`) return true;
    if (exampleSentence === `Ich möchte gerne ${w}.` || exampleSentence === `Ich möchte gerne ${cleanW}.`) return true;
    if (exampleSentence.includes('„Das ist es geht.“') || exampleSentence.includes('Das ist es geht')) return true;
    if (exampleSentence.includes('Ich möchte gerne danken') || exampleSentence.includes('Ich möchte gerne heißen')) return true;
  }

  return false;
}
