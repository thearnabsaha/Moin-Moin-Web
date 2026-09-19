/**
 * Comprehensive German-to-English dictionary fallback for A1-B2 vocabulary.
 * Guarantees that words always have accurate, natural English meanings and realistic example sentences.
 */

export interface DictionaryEntry {
  canonicalWord?: string;
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
  'danken': { meaning: 'to thank', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich danke Ihnen herzlich für Ihre Hilfe.', verbType: 'regular', auxiliaryType: 'haben' },
  'heißen': { meaning: 'to be called, to be named, to mean', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich heiße Anna und komme aus Berlin.', verbType: 'irregular', auxiliaryType: 'haben' },
  'es geht': { meaning: 'so-so, it is okay, doing fine', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Wie geht es dir? – Es geht, danke.', verbType: null, auxiliaryType: 'sein' },
  'es gibt': { meaning: 'there is, there are', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'In der Stadt gibt es viele interessante Museen.' },
  'wie gehts': { meaning: 'how is it going? how are you?', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Hallo Thomas! Wie geht\'s dir heute?' },
  'wie geht es': { meaning: 'how is it going? how are you?', partOfSpeech: 'other', gender: null, cefrLevel: 'A1', exampleSentence: 'Wie geht es Ihnen, Herr Meier?' },
  'bekommen': { meaning: 'to get, to receive', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich bekomme jeden Tag viele E-Mails.', verbType: 'irregular', auxiliaryType: 'haben' },
  'bestellen': { meaning: 'to order', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir möchten bitte zwei Pizzen bestellen.', verbType: 'regular', auxiliaryType: 'haben' },
  'besuchen': { meaning: 'to visit', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Am Wochenende besuche ich meine Großeltern.', verbType: 'regular', auxiliaryType: 'haben' },
  'fehlen': { meaning: 'to miss, to lack, to be missing', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Du fehlst mir sehr!', verbType: 'regular', auxiliaryType: 'haben' },
  'feiern': { meaning: 'to celebrate', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Heute Abend feiern wir seinen Geburtstag.', verbType: 'regular', auxiliaryType: 'haben' },
  'fliegen': { meaning: 'to fly', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Im Sommer fliegen wir nach Spanien in den Urlaub.', verbType: 'irregular', auxiliaryType: 'sein' },
  'glauben': { meaning: 'to believe, to think', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich glaube, dass alles gut klappen wird.', verbType: 'regular', auxiliaryType: 'haben' },
  'hoffen': { meaning: 'to hope', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich hoffe, dass du die Prüfung bestehst.', verbType: 'regular', auxiliaryType: 'haben' },
  'holen': { meaning: 'to get, to fetch', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich hole schnell meine Jacke aus dem Zimmer.', verbType: 'regular', auxiliaryType: 'haben' },
  'kochen': { meaning: 'to cook', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er kocht gerne frische Nudeln.', verbType: 'regular', auxiliaryType: 'haben' },
  'kosten': { meaning: 'to cost', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wie viel kostet dieses Ticket?', verbType: 'regular', auxiliaryType: 'haben' },
  'lachen': { meaning: 'to laugh', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Die Kinder lachen über den lustigen Film.', verbType: 'regular', auxiliaryType: 'haben' },
  'passen': { meaning: 'to fit, to suit', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Passt es Ihnen morgen um 10 Uhr?', verbType: 'regular', auxiliaryType: 'haben' },
  'reisen': { meaning: 'to travel', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir reisen sehr gerne in andere Länder.', verbType: 'regular', auxiliaryType: 'sein' },
  'schmecken': { meaning: 'to taste', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Das Essen schmeckt wirklich hervorragend!', verbType: 'regular', auxiliaryType: 'haben' },
  'setzen': { meaning: 'to set, to sit down', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Setzen Sie sich bitte auf diesen Stuhl.', verbType: 'regular', auxiliaryType: 'haben' },
  'stellen': { meaning: 'to put upright, to place', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Er stellt die Vase auf den Tisch.', verbType: 'regular', auxiliaryType: 'haben' },
  'suchen': { meaning: 'to search for, to look for', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich suche schon den ganzen Morgen meinen Schlüssel.', verbType: 'regular', auxiliaryType: 'haben' },
  'tanzen': { meaning: 'to dance', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Sie tanzen zusammen auf der Party.', verbType: 'regular', auxiliaryType: 'haben' },
  'treffen': { meaning: 'to meet', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich treffe meine Freunde heute im Café.', verbType: 'irregular', auxiliaryType: 'haben' },
  'vergessen': { meaning: 'to forget', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Vergiss bitte deinen Regenschirm nicht!', verbType: 'irregular', auxiliaryType: 'haben' },
  'waschen': { meaning: 'to wash', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich wasche mir vor dem Essen gründlich die Hände.', verbType: 'irregular', auxiliaryType: 'haben' },
  'wünschen': { meaning: 'to wish', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Ich wünsche dir einen wunderschönen Tag!', verbType: 'regular', auxiliaryType: 'haben' },
  'zahlen': { meaning: 'to pay', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Wir möchten bitte zusammen zahlen.', verbType: 'regular', auxiliaryType: 'haben' },
  'zeigen': { meaning: 'to show', partOfSpeech: 'verb', gender: null, cefrLevel: 'A1', exampleSentence: 'Können Sie mir bitte den Weg zum Bahnhof zeigen?', verbType: 'regular', auxiliaryType: 'haben' },

  // Essential Nouns
  'apfel': { meaning: 'apple', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Äpfel', cefrLevel: 'A1', exampleSentence: 'Ich esse jeden Morgen einen frischen Apfel.' },
  'buch': { meaning: 'book', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Bücher', cefrLevel: 'A1', exampleSentence: 'Ich lese ein interessantes Buch auf Deutsch.' },
  'haus': { meaning: 'house', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Häuser', cefrLevel: 'A1', exampleSentence: 'Unser Haus hat einen schönen Garten.' },
  'hund': { meaning: 'dog', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Hunde', cefrLevel: 'A1', exampleSentence: 'Der Hund spielt fröhlich im Garten.' },
  'katze': { meaning: 'cat', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Katzen', cefrLevel: 'A1', exampleSentence: 'Die Katze schläft gemütlich auf dem Sofa.' },
  'tisch': { meaning: 'table', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Tische', cefrLevel: 'A1', exampleSentence: 'Das Essen steht schon auf dem Tisch.' },
  'stuhl': { meaning: 'chair', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Stühle', cefrLevel: 'A1', exampleSentence: 'Nimm bitte auf dem Stuhl Platz.' },
  'auto': { meaning: 'car', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Autos', cefrLevel: 'A1', exampleSentence: 'Mein neues Auto fährt sehr schnell.' },
  'brot': { meaning: 'bread', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Brote', cefrLevel: 'A1', exampleSentence: 'Ich kaufe frisches Brot beim Bäcker.' },
  'wasser': { meaning: 'water', partOfSpeech: 'noun', gender: 'neuter', pluralForm: null, cefrLevel: 'A1', exampleSentence: 'Bitte trinke ausreichend kaltes Wasser.' },
  'kaffee': { meaning: 'coffee', partOfSpeech: 'noun', gender: 'masculine', pluralForm: null, cefrLevel: 'A1', exampleSentence: 'Morgens trinke ich immer eine Tasse Kaffee.' },
  'tee': { meaning: 'tea', partOfSpeech: 'noun', gender: 'masculine', pluralForm: null, cefrLevel: 'A1', exampleSentence: 'Möchtest du heißen Tee mit Zitrone?' },
  'milch': { meaning: 'milk', partOfSpeech: 'noun', gender: 'feminine', pluralForm: null, cefrLevel: 'A1', exampleSentence: 'Gießen Sie etwas Milch in den Kaffee.' },
  'frühstück': { meaning: 'breakfast', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Frühstücke', cefrLevel: 'A1', exampleSentence: 'Zum Frühstück esse ich Müsli und Obst.' },
  'mittagessen': { meaning: 'lunch', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Mittagessen', cefrLevel: 'A1', exampleSentence: 'Um zwölf Uhr machen wir Pause fürs Mittagessen.' },
  'abendessen': { meaning: 'dinner, supper', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Abendessen', cefrLevel: 'A1', exampleSentence: 'Was kochen wir heute zum Abendessen?' },
  'mädchen': { meaning: 'girl', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Mädchen', cefrLevel: 'A1', exampleSentence: 'Das kleine Mädchen lacht fröhlich.' },
  'junge': { meaning: 'boy', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Jungen', cefrLevel: 'A1', exampleSentence: 'Der Junge spielt draußen Fußball.' },
  'mann': { meaning: 'man, husband', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Männer', cefrLevel: 'A1', exampleSentence: 'Der Mann wartet an der Haltestelle.' },
  'frau': { meaning: 'woman, wife, Ms.', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Frauen', cefrLevel: 'A1', exampleSentence: 'Frau Schmidt unterrichtet Deutsch an der Schule.' },
  'kind': { meaning: 'child', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Kinder', cefrLevel: 'A1', exampleSentence: 'Das Kind malt ein schönes Bild.' },
  'freund': { meaning: 'friend (male)', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Freunde', cefrLevel: 'A1', exampleSentence: 'Mein bester Freund wohnt in Hamburg.' },
  'freundin': { meaning: 'friend (female), girlfriend', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Freundinnen', cefrLevel: 'A1', exampleSentence: 'Meine Freundin lernt auch Deutsch.' },
  'stadt': { meaning: 'city, town', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Städte', cefrLevel: 'A1', exampleSentence: 'Berlin ist eine sehr lebendige Stadt.' },
  'schule': { meaning: 'school', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Schulen', cefrLevel: 'A1', exampleSentence: 'Die Kinder gehen gerne in die Schule.' },
  'arzt': { meaning: 'doctor, physician', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Ärzte', cefrLevel: 'A1', exampleSentence: 'Der Arzt untersucht den Patienten.' },
  'zeit': { meaning: 'time', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Zeiten', cefrLevel: 'A1', exampleSentence: 'Hast du heute etwas freie Zeit für mich?' },
  'tag': { meaning: 'day', partOfSpeech: 'noun', gender: 'masculine', pluralForm: 'die Tage', cefrLevel: 'A1', exampleSentence: 'Ich wünsche dir einen wunderschönen Tag!' },
  'nacht': { meaning: 'night', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Nächte', cefrLevel: 'A1', exampleSentence: 'Gute Nacht und schlaf gut!' },
  'woche': { meaning: 'week', partOfSpeech: 'noun', gender: 'feminine', pluralForm: 'die Wochen', cefrLevel: 'A1', exampleSentence: 'Nächste Woche fahre ich in den Urlaub.' },
  'jahr': { meaning: 'year', partOfSpeech: 'noun', gender: 'neuter', pluralForm: 'die Jahre', cefrLevel: 'A1', exampleSentence: 'Ich lerne seit einem Jahr Deutsch.' },
};

const COMMON_TYPOS: Record<string, string> = {
  'gehn': 'gehen',
  'sehn': 'sehen',
  'stehn': 'stehen',
  'fahrem': 'fahren',
  'nehm': 'nehmen',
  'artzt': 'arzt',
  'schuller': 'schüler',
  'fruehstueck': 'frühstück',
  'fruhstuck': 'frühstück',
  'madchen': 'mädchen',
  'maedchen': 'mädchen',
};

function makeEntryWithCanonical(key: string, entry: DictionaryEntry): DictionaryEntry {
  let canonicalWord = key;
  if (entry.partOfSpeech === 'noun') {
    const art = entry.gender === 'feminine' ? 'die' : entry.gender === 'neuter' ? 'das' : 'der';
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    canonicalWord = `${art} ${cap}`;
  }
  return { ...entry, canonicalWord };
}

/**
 * Returns clean dictionary entry if available with phonetic/typo resilience.
 */
export function lookupWord(raw: string): DictionaryEntry | null {
  if (!raw || typeof raw !== 'string') return null;

  const stripped = raw
    .toLowerCase()
    .replace(/^["'„“«»`]+|["'„“«»`]+$/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();

  const clean = stripped
    .replace(/^(der|die|das|ein|eine|einen|einem|einer|eines)\s+/i, '')
    .trim();

  if (!clean) return null;

  // 1. Direct match (by clean base or full expression)
  if (COMMON_GERMAN_DICTIONARY[clean]) {
    return makeEntryWithCanonical(clean, COMMON_GERMAN_DICTIONARY[clean]);
  }
  if (COMMON_GERMAN_DICTIONARY[stripped]) {
    return makeEntryWithCanonical(stripped, COMMON_GERMAN_DICTIONARY[stripped]);
  }
  const rawKey = raw.toLowerCase().trim();
  if (COMMON_GERMAN_DICTIONARY[rawKey]) {
    return makeEntryWithCanonical(rawKey, COMMON_GERMAN_DICTIONARY[rawKey]);
  }

  // 2. Common typos / shortcuts
  if (COMMON_TYPOS[clean] && COMMON_GERMAN_DICTIONARY[COMMON_TYPOS[clean]]) {
    const targetKey = COMMON_TYPOS[clean];
    return makeEntryWithCanonical(targetKey, COMMON_GERMAN_DICTIONARY[targetKey]);
  }

  // 3. Digraph expansion (ae -> ä, oe -> ö, ue -> ü, ss -> ß)
  const withDigraphs = clean
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü')
    .replace(/ss/g, 'ß');
  if (COMMON_GERMAN_DICTIONARY[withDigraphs]) {
    return makeEntryWithCanonical(withDigraphs, COMMON_GERMAN_DICTIONARY[withDigraphs]);
  }

  // 4. Missing umlaut replacement (e.g. fruhstuck -> frühstück, madchen -> mädchen)
  const withUmlauts = clean
    .replace(/u/g, 'ü')
    .replace(/a/g, 'ä')
    .replace(/o/g, 'ö');
  if (COMMON_GERMAN_DICTIONARY[withUmlauts]) {
    return makeEntryWithCanonical(withUmlauts, COMMON_GERMAN_DICTIONARY[withUmlauts]);
  }

  return null;
}
