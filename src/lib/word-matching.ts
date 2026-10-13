/**
 * Intelligent Answer Matcher for DeutschForge
 * Handles:
 * 1. Multiple synonyms/answers (if among 2-3 answers even 1 is right, it marks correct).
 * 2. User entering multiple answers (if any user answer matches any target, marks correct).
 * 3. English/German articles ("the zoo" vs "zoo", "to eat" vs "eat", "der Zoo" vs "Zoo").
 * 4. Compound words and spacing ("fullmoon" vs "full moon" vs "full-moon").
 * 5. German umlaut/eszett normalization (ä/ae, ö/oe, ü/ue, ß/ss).
 * 6. Parenthetical definitions ("drive (a vehicle)" -> "drive").
 * 7. Singular/plural inflection tolerance ("piglet" vs "piglets").
 */

export function stripArticlesAndTo(s: string): string {
  return s
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/^(to)\s+/i, '')
    .replace(/^(der|die|das|dem|den|des|ein|eine|einer|einem|einen|eines)\s+/i, '')
    .trim();
}

export function cleanPunctuation(s: string): string {
  return s.trim().toLowerCase().replace(/[.,;:!?'"()]/g, '');
}

export function normalizeGerman(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, '')
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü')
    .replace(/ss/g, 'ß');
}

export function collapseSpaces(s: string): string {
  return s.toLowerCase().replace(/[\s\-_'"`]+/g, '');
}

export function stripPluralS(s: string): string {
  if (s.length > 3 && s.endsWith('s')) {
    return s.slice(0, -1);
  }
  return s;
}

export function extractVariants(raw: string): string[] {
  if (!raw) return [];
  const results = new Set<string>();

  // 1. Raw string itself
  const trimmed = raw.trim();
  if (trimmed) results.add(trimmed);

  // 2. Handle parentheses: "to drive (a vehicle)" -> "to drive", "a vehicle", "to drive a vehicle"
  const withoutParens = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutParens && withoutParens !== raw) {
    results.add(withoutParens);
  }
  const parenMatches = raw.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const pm of parenMatches) {
      const inside = pm.slice(1, -1).trim();
      if (inside) results.add(inside);
    }
  }

  // 3. Split by delimiters: commas, semicolons, slashes, pipes, " or ", " / ", " oder "
  const splitTokens: string[] = [];
  for (const item of Array.from(results)) {
    const parts = item.split(/[,;/|]|\b(?:or|oder)\b/i);
    for (const p of parts) {
      const part = p.trim();
      if (part) splitTokens.push(part);
    }
  }

  for (const t of splitTokens) {
    results.add(t);
    const noArt = stripArticlesAndTo(t);
    if (noArt) results.add(noArt);
  }

  return Array.from(results).filter(Boolean);
}

export function checkWordOnly(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer || !correctAnswer) return false;

  const uRaw = userAnswer.trim();
  const cRaw = correctAnswer.trim();
  if (!uRaw || !cRaw) return false;

  // Extract all possible answer tokens from the user
  const userVariants = extractVariants(uRaw);
  // Extract all possible valid variants from the correct answer
  const correctVariants = extractVariants(cRaw);

  // Compare every user variant against every correct variant
  for (const u of userVariants) {
    const uClean = cleanPunctuation(u);
    const uNoArt = stripArticlesAndTo(uClean);
    const uCollapse = collapseSpaces(uClean);
    const uNoArtCollapse = collapseSpaces(uNoArt);
    const uNormGer = normalizeGerman(uClean);
    const uNormGerNoArt = normalizeGerman(uNoArt);

    for (const c of correctVariants) {
      const cClean = cleanPunctuation(c);
      const cNoArt = stripArticlesAndTo(cClean);
      const cCollapse = collapseSpaces(cClean);
      const cNoArtCollapse = collapseSpaces(cNoArt);
      const cNormGer = normalizeGerman(cClean);
      const cNormGerNoArt = normalizeGerman(cNoArt);

      // 1. Direct exact or punctuation-cleaned equality
      if (uClean === cClean) return true;

      // 2. Without articles/to equality ("the zoo" vs "zoo", "to eat" vs "eat", "der Vollmond" vs "Vollmond")
      if (uNoArt === cNoArt || uNoArt === cClean || uClean === cNoArt) return true;

      // 3. Collapsed spaces/hyphens ("fullmoon" vs "full moon", "full-moon")
      if (uCollapse === cCollapse || uNoArtCollapse === cNoArtCollapse) return true;
      if (uCollapse === cNoArtCollapse || uNoArtCollapse === cCollapse) return true;

      // 4. German normalization (ä/ae, ö/oe, ü/ue, ß/ss)
      if (uNormGer === cNormGer || uNormGerNoArt === cNormGerNoArt) return true;
      if (uNormGer === cNormGerNoArt || uNormGerNoArt === cNormGer) return true;

      // 5. Collapsed German normalization
      if (collapseSpaces(uNormGer) === collapseSpaces(cNormGer)) return true;
      if (collapseSpaces(uNormGerNoArt) === collapseSpaces(cNormGerNoArt)) return true;

      // 6. Singular/plural tolerance (e.g. "piglet" vs "piglets", "wild boar" vs "wild boars")
      if (stripPluralS(uNoArtCollapse) === stripPluralS(cNoArtCollapse)) return true;
    }
  }

  return false;
}

export function matchesMeaning(userInput: string, meaning: string): boolean {
  if (!userInput || !meaning) return false;
  return checkWordOnly(userInput, meaning);
}
