import { db } from '../src/lib/db';
import { userWords } from '../src/lib/schema';
import { eq } from 'drizzle-orm';
import { isCorruptedWordData, normalizeWord } from '../src/lib/word-parser';
import { lookupWord } from '../src/lib/dictionary-data';
import { enrichWordsWithGemini } from '../src/lib/gemini';

async function heal() {
  console.log('--- Starting DB Word Healing ---');
  const allRows = await db.select().from(userWords);
  console.log(`Scanning ${allRows.length} total rows in userWords...`);

  const corruptedRows = allRows.filter((r) =>
    isCorruptedWordData(r.word, r.meaning, r.exampleSentence, r.partOfSpeech)
  );

  console.log(`Found ${corruptedRows.length} corrupted rows needing repair.`);

  let repaired = 0;
  const stillNeedsAi: typeof corruptedRows = [];

  // 1. First pass: High-speed exact dictionary lookup
  for (const row of corruptedRows) {
    const clean = normalizeWord(row.word);
    const raw = row.word.trim().toLowerCase();
    const dict = lookupWord(clean) || lookupWord(raw);

    if (dict) {
      console.log(`[Dict Repair] "${row.word}": "${row.meaning}" -> "${dict.meaning}"`);
      await db
        .update(userWords)
        .set({
          meaning: dict.meaning,
          exampleSentence: dict.exampleSentence ?? row.exampleSentence,
          gender: dict.partOfSpeech === 'noun' ? (dict.gender ?? null) : null,
          partOfSpeech: dict.partOfSpeech || row.partOfSpeech,
        })
        .where(eq(userWords.id, row.id));
      repaired++;
    } else {
      stillNeedsAi.push(row);
    }
  }

  // 2. Second pass: High-tier AI model enrichment for non-dictionary words
  if (stillNeedsAi.length > 0) {
    console.log(`Enriching ${stillNeedsAi.length} remaining words with AI cascade...`);
    const wordList = stillNeedsAi.map((r) => r.word);
    const aiResults = await enrichWordsWithGemini(wordList);

    for (let i = 0; i < stillNeedsAi.length; i++) {
      const target = stillNeedsAi[i];
      const enriched = aiResults[i];

      if (
        enriched &&
        enriched.meaning &&
        !isCorruptedWordData(target.word, enriched.meaning, enriched.example_sentence, enriched.part_of_speech)
      ) {
        console.log(`[AI Repair] "${target.word}": "${target.meaning}" -> "${enriched.meaning}"`);
        await db
          .update(userWords)
          .set({
            meaning: enriched.meaning,
            exampleSentence: enriched.example_sentence ?? target.exampleSentence,
            gender: enriched.part_of_speech === 'noun' ? (enriched.gender ?? null) : null,
            partOfSpeech: enriched.part_of_speech,
          })
          .where(eq(userWords.id, target.id));
        repaired++;
      }
    }
  }

  console.log(`--- Healing Complete: Repaired ${repaired}/${corruptedRows.length} rows ---`);
}

heal()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Healing failed:', e);
    process.exit(1);
  });
