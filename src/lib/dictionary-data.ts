/**
 * Comprehensive German-to-English dictionary fallback for A1-B2 vocabulary.
 * Guarantees that words always have accurate, natural English meanings and realistic example sentences.
 */

export interface DictionaryEntry {
  meaning: string;
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'pronoun' | 'article' | 'other';
  gender?: 'masculine' | 'feminine' | 'neuter' | null;
  pluralForm?: string | null;
  cefrLevel?: 'A1' | 'A2' | 'B1' | 'B2';
  exampleSentence?: string;
  verbType?: 'regular' | 'irregular' | 'mixed' | null;
  auxiliaryType?: 'haben' | 'sein' | null;
}

export const COMMON_GERMAN_DICTIONARY: Record<string, DictionaryEntry> = {
  // Core Verbs from user report
  'geben': {
    meaning: 'to give',
    partOfSpeech: 'verb',
    gender: null,
    cefrLevel: 'A1',
    exampleSentence: 'Ich gebe dir meinen Stift.',
    verbType: 'irregular',
    auxiliaryType: 'haben',
  },
  'gratulieren': {
    meaning: 'to congratulate',
    partOfSpeech: 'verb',
    gender: null,
    cefrLevel: 'A1',
    exampleSentence: 'Ich gratuliere dir herzlich zum Geburtstag!',
    verbType: 'regular',
    auxiliaryType: 'haben',
  },
  'gefallen': {
    meaning: 'to please, to appeal to, to like',
    partOfSpeech: 'verb',
    gender: null,
    cefrLevel: 'A1',
    exampleSentence: 'Dieses schöne Kleid gefällt mir sehr gut.',
    verbType: 'irregular',
    auxiliaryType: 'haben',
  },
  'gehören': {
    meaning: 'to belong to',
    partOfSpeech: 'verb',
    gender: null,
    cefrLevel: 'A1',
    exampleSentence: 'Das Buch gehört meiner Schwester.',
    verbType: 'regular',
    auxiliaryType: 'haben',
  },
  'versprechen': {
    meaning: 'to promise',
    partOfSpeech: 'verb',
    gender: null,
    cefrLevel: 'B1',
    exampleSentence: 'Ich verspreche dir, dass ich pünktlich komme.',
    verbType: 'irregular',
    auxiliaryType: 'haben',
  },

  // Common Adverbs & Particles
  'immer': { meaning: 'always', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er kommt immer pünktlich zum Unterricht.' },
  'nie': { meaning: 'never', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich war noch nie in Deutschland.' },
  'oft': { meaning: 'often', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir gehen oft im Park spazieren.' },
  'manchmal': { meaning: 'sometimes', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Manchmal esse ich Pizza zu Mittag.' },
  'jetzt': { meaning: 'now', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Jetzt müssen wir nach Hause gehen.' },
  'leider': { meaning: 'unfortunately', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich kann leider nicht zur Party kommen.' },
  'vielleicht': { meaning: 'perhaps, maybe', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Vielleicht sehen wir uns morgen wieder.' },
  'wirklich': { meaning: 'really, truly', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Das ist wirklich eine gute Idee.' },
  'gerne': { meaning: 'gladly, with pleasure', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich trinke gerne heißen Kaffee.' },
  'gern': { meaning: 'gladly, with pleasure', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich helfe dir gern bei der Arbeit.' },
  'heute': { meaning: 'today', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Heute ist das Wetter wunderschön.' },
  'gestern': { meaning: 'yesterday', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Gestern bin ich zu Hause geblieben.' },
  'morgen': { meaning: 'tomorrow', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Morgen fahren wir nach München.' },
  'hier': { meaning: 'here', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Hier ist dein Schlüssel.' },
  'dort': { meaning: 'there', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Dort steht mein neues Auto.' },
  'da': { meaning: 'there, here', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Da drüben ist der Ausgang.' },
  'oben': { meaning: 'above, upstairs', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Meine Wohnung liegt ganz oben.' },
  'unten': { meaning: 'below, downstairs', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Der Keller befindet sich unten.' },
  'links': { meaning: 'on the left, to the left', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Biegen Sie an der Kreuzung nach links ab.' },
  'rechts': { meaning: 'on the right, to the right', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Das Geschäft liegt auf der rechten Seite.' },
  'geradeaus': { meaning: 'straight ahead', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Fahren Sie bitte zwei Kilometer geradeaus.' },
  'zurück': { meaning: 'back, return', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wann kommst du aus dem Urlaub zurück?' },
  'zusammen': { meaning: 'together', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir lernen jeden Abend zusammen Deutsch.' },
  'allein': { meaning: 'alone', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er wohnt ganz allein in einer Wohnung.' },
  'schon': { meaning: 'already', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich habe meine Hausaufgaben schon gemacht.' },
  'noch': { meaning: 'still, yet', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Bist du noch im Büro?' },
  'nicht': { meaning: 'not', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Das weiß ich leider nicht.' },
  'nichts': { meaning: 'nothing', partOfSpeech: 'pronoun', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich habe heute Morgen nichts gegessen.' },
  'nur': { meaning: 'only, just', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich brauche nur fünf Minuten Zeit.' },
  'sehr': { meaning: 'very', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Vielen Dank, das freut mich sehr.' },
  'so': { meaning: 'so, thus, like this', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Warum machst du das so?' },
  'sofort': { meaning: 'immediately, right away', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich rufe dich sofort zurück.' },
  'bald': { meaning: 'soon', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Bis bald! Ich freue mich auf dich.' },
  'spät': { meaning: 'late', partOfSpeech: 'adjective', gender: null, cefrLevel: 'A1', exampleSentence: 'Es ist schon sehr spät am Abend.' },
  'früh': { meaning: 'early', partOfSpeech: 'adjective', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich muss morgen sehr früh aufstehen.' },
  'viel': { meaning: 'much, a lot', partOfSpeech: 'adjective', gender: null, cefrLevel: 'A1', exampleSentence: 'Er hat heute sehr viel Arbeit.' },
  'viele': { meaning: 'many', partOfSpeech: 'adjective', gender: null, cefrLevel: 'A1', exampleSentence: 'Viele Menschen besuchen das Museum.' },
  'wenig': { meaning: 'little, few', partOfSpeech: 'adjective', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich habe nur wenig geschlafen.' },
  'weit': { meaning: 'far, distant', partOfSpeech: 'adjective', gender: null, cefrLevel: 'A1', exampleSentence: 'Der Bahnhof ist nicht weit von hier.' },
  'weiter': { meaning: 'further, continue', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Gehen Sie bitte noch etwas weiter.' },
  'lange': { meaning: 'long (time)', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wie lange bleibst du in Berlin?' },
  'meist': { meaning: 'mostly, usually', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A2', exampleSentence: 'Am Wochenende schlafe ich meist lange.' },
  'ja': { meaning: 'yes', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Ja, ich verstehe das.' },
  'nein': { meaning: 'no', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Nein, das möchte ich nicht.' },
  'bitte': { meaning: 'please, you are welcome', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Ein Glas Wasser, bitte.' },
  'danke': { meaning: 'thank you, thanks', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Danke für deine Hilfe!' },
  'wie': { meaning: 'how, like', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wie heißt du?' },
  'wo': { meaning: 'where', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wo wohnst du?' },
  'woher': { meaning: 'where from', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Woher kommst du?' },
  'wohin': { meaning: 'where to', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wohin fährst du am Wochenende?' },
  'wann': { meaning: 'when', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wann fängt der Kurs an?' },
  'warum': { meaning: 'why', partOfSpeech: 'adverb', gender: null, cefrLevel: 'A1', exampleSentence: 'Warum lernst du Deutsch?' },
  'wer': { meaning: 'who', partOfSpeech: 'pronoun', gender: null, cefrLevel: 'A1', exampleSentence: 'Wer hat an der Tür geklopft?' },
  'was': { meaning: 'what', partOfSpeech: 'pronoun', gender: null, cefrLevel: 'A1', exampleSentence: 'Was machst du heute Abend?' },
  'zu': { meaning: 'to, closed, too', partOfSpeech: 'preposition', gender: null, cefrLevel: 'A1', exampleSentence: 'Die Tür ist leider zu.' },

  // Essential Verbs
  'haben': { meaning: 'to have', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich habe einen Hund.', verbType: 'irregular', auxiliaryType: 'haben' },
  'sein': { meaning: 'to be', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich bin Student in Berlin.', verbType: 'irregular', auxiliaryType: 'sein' },
  'werden': { meaning: 'to become, will', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Es wird draußen langsam dunkel.', verbType: 'irregular', auxiliaryType: 'sein' },
  'können': { meaning: 'can, to be able to', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich kann gut Deutsch sprechen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'müssen': { meaning: 'must, to have to', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich muss heute pünktlich aufstehen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'wollen': { meaning: 'to want to', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir wollen nach Hause gehen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'sollen': { meaning: 'should, ought to', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Der Arzt sagt, ich soll mich ausruhen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'dürfen': { meaning: 'may, to be allowed to', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Hier darf man nicht rauchen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'mögen': { meaning: 'to like', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich mag frisches Obst sehr.', verbType: 'irregular', auxiliaryType: 'haben' },
  'möchten': { meaning: 'would like to', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich möchte gerne einen Tee bestellen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'gehen': { meaning: 'to go, to walk', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich gehe jeden Tag zur Arbeit.', verbType: 'irregular', auxiliaryType: 'sein' },
  'kommen': { meaning: 'to come', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Woher kommst du ursprünglich?', verbType: 'irregular', auxiliaryType: 'sein' },
  'machen': { meaning: 'to do, to make', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Was machst du in deiner Freizeit?', verbType: 'regular', auxiliaryType: 'haben' },
  'sagen': { meaning: 'to say, to tell', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Kannst du mir deinen Namen sagen?', verbType: 'regular', auxiliaryType: 'haben' },
  'sehen': { meaning: 'to see', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich sehe meine Freunde morgen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'wissen': { meaning: 'to know (a fact)', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Weißt du, wie spät es ist?', verbType: 'irregular', auxiliaryType: 'haben' },
  'kennen': { meaning: 'to know (a person or place)', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich kenne ihn seit vielen Jahren.', verbType: 'mixed', auxiliaryType: 'haben' },
  'finden': { meaning: 'to find, to consider', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich finde meine Schlüssel nicht.', verbType: 'irregular', auxiliaryType: 'haben' },
  'bleiben': { meaning: 'to stay, to remain', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir bleiben heute Abend zu Hause.', verbType: 'irregular', auxiliaryType: 'sein' },
  'liegen': { meaning: 'to lie, to be located', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Berlin liegt im Osten von Deutschland.', verbType: 'irregular', auxiliaryType: 'haben' },
  'stehen': { meaning: 'to stand', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er steht vor der Haustür.', verbType: 'irregular', auxiliaryType: 'haben' },
  'sitzen': { meaning: 'to sit', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir sitzen gemütlich im Wohnzimmer.', verbType: 'irregular', auxiliaryType: 'haben' },
  'fahren': { meaning: 'to drive, to travel', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er fährt jeden Morgen mit dem Zug.', verbType: 'irregular', auxiliaryType: 'sein' },
  'laufen': { meaning: 'to walk, to run', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich laufe gerne durch den Stadtpark.', verbType: 'irregular', auxiliaryType: 'sein' },
  'essen': { meaning: 'to eat', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir essen am Abend warm.', verbType: 'irregular', auxiliaryType: 'haben' },
  'trinken': { meaning: 'to drink', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er trinkt jeden Tag zwei Liter Wasser.', verbType: 'irregular', auxiliaryType: 'haben' },
  'schlafen': { meaning: 'to sleep', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Das Kind schläft ruhig in seinem Bett.', verbType: 'irregular', auxiliaryType: 'haben' },
  'sprechen': { meaning: 'to speak', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Sprichst du fließend Deutsch?', verbType: 'irregular', auxiliaryType: 'haben' },
  'lesen': { meaning: 'to read', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Sie liest gerne spannende Bücher.', verbType: 'irregular', auxiliaryType: 'haben' },
  'schreiben': { meaning: 'to write', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich schreibe dir heute eine Nachricht.', verbType: 'irregular', auxiliaryType: 'haben' },
  'hören': { meaning: 'to hear, to listen', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Hörst du gerne klassische Musik?', verbType: 'regular', auxiliaryType: 'haben' },
  'lernen': { meaning: 'to learn, to study', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir lernen jeden Tag neue Vokabeln.', verbType: 'regular', auxiliaryType: 'haben' },
  'verstehen': { meaning: 'to understand', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich verstehe diese Erklärung sehr gut.', verbType: 'irregular', auxiliaryType: 'haben' },
  'fragen': { meaning: 'to ask', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Darf ich dir eine kurze Frage stellen?', verbType: 'regular', auxiliaryType: 'haben' },
  'antworten': { meaning: 'to answer', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er antwortet immer sehr höflich.', verbType: 'regular', auxiliaryType: 'haben' },
  'brauchen': { meaning: 'to need', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Brauchst du Hilfe bei deinen Hausaufgaben?', verbType: 'regular', auxiliaryType: 'haben' },
  'kaufen': { meaning: 'to buy', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich kaufe heute frisches Brot im Supermarkt.', verbType: 'regular', auxiliaryType: 'haben' },
  'verkaufen': { meaning: 'to sell', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er verkauft sein altes Fahrrad.', verbType: 'regular', auxiliaryType: 'haben' },
  'bezahlen': { meaning: 'to pay', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Kann ich hier mit Karte bezahlen?', verbType: 'regular', auxiliaryType: 'haben' },
  'wohnen': { meaning: 'to reside, to live', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wo wohnst du in Berlin?', verbType: 'regular', auxiliaryType: 'haben' },
  'leben': { meaning: 'to live (exist)', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Meine Großeltern leben auf dem Land.', verbType: 'regular', auxiliaryType: 'haben' },
  'arbeiten': { meaning: 'to work', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Sie arbeitet als Ärztin im Krankenhaus.', verbType: 'regular', auxiliaryType: 'haben' },
  'spielen': { meaning: 'to play', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Die Kinder spielen draußen im Garten.', verbType: 'regular', auxiliaryType: 'haben' },
  'warten': { meaning: 'to wait', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich warte an der Bushaltestelle auf dich.', verbType: 'regular', auxiliaryType: 'haben' },
  'helfen': { meaning: 'to help', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Kannst du mir bitte kurz helfen?', verbType: 'irregular', auxiliaryType: 'haben' },
  'nehmen': { meaning: 'to take', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich nehme ein Glas Orangensaft.', verbType: 'irregular', auxiliaryType: 'haben' },
  'bringen': { meaning: 'to bring', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Bringst du mir bitte ein Glas Wasser mit?', verbType: 'mixed', auxiliaryType: 'haben' },
  'öffnen': { meaning: 'to open', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Kannst du bitte das Fenster öffnen?', verbType: 'regular', auxiliaryType: 'haben' },
  'schließen': { meaning: 'to close', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Vergiss nicht, die Haustür zu schließen.', verbType: 'irregular', auxiliaryType: 'haben' },
  'anfangen': { meaning: 'to start, to begin', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wann fängt der Deutschkurs an?', verbType: 'irregular', auxiliaryType: 'haben' },
  'aufhören': { meaning: 'to stop, to cease', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Der Regen hat endlich aufgehört.', verbType: 'regular', auxiliaryType: 'haben' },
  'aufstehen': { meaning: 'to stand up, to get up', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich stehe jeden Morgen um sieben Uhr auf.', verbType: 'irregular', auxiliaryType: 'sein' },
  'einschlafen': { meaning: 'to fall asleep', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er schläft immer sehr schnell ein.', verbType: 'irregular', auxiliaryType: 'sein' },
  'ankommen': { meaning: 'to arrive', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Der Zug kommt pünktlich um 14 Uhr an.', verbType: 'irregular', auxiliaryType: 'sein' },
  'abfahren': { meaning: 'to depart', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Der Bus fährt in fünf Minuten ab.', verbType: 'irregular', auxiliaryType: 'sein' },
};

/**
 * Returns clean dictionary entry if available.
 */
export function lookupWord(raw: string): DictionaryEntry | null {
  const clean = raw
    .toLowerCase()
    .replace(/^(der|die|das|ein|eine|einen|einem|einer|eines)\s+/i, '')
    .trim();

  return COMMON_GERMAN_DICTIONARY[clean] || COMMON_GERMAN_DICTIONARY[raw.toLowerCase().trim()] || null;
}
