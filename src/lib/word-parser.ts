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
