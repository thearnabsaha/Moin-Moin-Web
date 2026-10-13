import {
  pgTable,
  text,
  timestamp,
  real,
  integer,
  uniqueIndex,
  index,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// ── USERS ────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  username: text('username').notNull().default(''),
  passwordHash: text('password_hash').notNull().default(''),
  name: text('name').notNull().default('Learner'),
  targetLevel: text('target_level').notNull().default('A1'),
  timezone: text('timezone').notNull().default('Europe/Berlin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
}, (t) => ({
  usernameUniq: uniqueIndex('users_username_uniq').on(t.username),
}));

export const userSettings = pgTable('user_settings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('system'),
  focusMode: boolean('focus_mode').notNull().default(false),
  dailyGoal: integer('daily_goal').notNull().default(20),
  soundEnabled: boolean('sound_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userUniq: uniqueIndex('user_settings_user_uniq').on(t.userId),
}));

// ── USER VOCABULARY ──────────────────────────────────────────

export const userWords = pgTable('user_words', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  word: text('word').notNull(),
  partOfSpeech: text('part_of_speech').notNull(),
  gender: text('gender'),
  pluralForm: text('plural_form'),
  conjugation: jsonb('conjugation').$type<Record<string, string>>(),
  meaning: text('meaning').notNull(),
  cefrLevel: text('cefr_level').notNull().default('A1'),
  exampleSentence: text('example_sentence'),
  verbType: text('verb_type'),
  auxiliaryType: text('auxiliary_type'),
  presentForm: text('present_form'),
  simplePast: text('simple_past'),
  perfectForm: text('perfect_form'),
  learned: boolean('learned').notNull().default(false),
  batchId: text('batch_id'),
  stability: real('stability').notNull().default(0),
  difficulty: real('difficulty').notNull().default(0),
  scheduledDays: real('scheduled_days').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  state: integer('state').notNull().default(0),
  lastReview: timestamp('last_review'),
  nextReview: timestamp('next_review').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userWordIdx: index('user_words_user_idx').on(t.userId),
  userBatchIdx: index('user_words_batch_idx').on(t.batchId),
  userNextReviewIdx: index('user_words_next_review_idx').on(t.userId, t.nextReview),
  userPosIdx: index('user_words_pos_idx').on(t.userId, t.partOfSpeech),
}));

export const wordReviewLogs = pgTable('word_review_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId: text('word_id').notNull().references(() => userWords.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  rating: integer('rating').notNull(),
  correct: boolean('correct').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
}, (t) => ({
  userReviewIdx: index('word_review_user_idx').on(t.userId, t.reviewedAt),
}));

// ── GRAMMAR ──────────────────────────────────────────────────

export const grammarAttempts = pgTable('grammar_attempts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull(), // References static GrammarTopic.id
  score: real('score').notNull(),
  maxScore: real('max_score').notNull(),
  answers: jsonb('answers').$type<Array<{
    exerciseId: string;
    userAnswer: string;
    correct: boolean;
  }>>().notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (t) => ({
  userTopicIdx: index('grammar_attempts_user_topic_idx').on(t.userId, t.topicId),
}));

export const userGrammarProgress = pgTable('user_grammar_progress', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  progress: jsonb('progress').$type<Record<string, unknown>>().notNull().default({}),
  practice: jsonb('practice').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userGrammarIdx: uniqueIndex('user_grammar_progress_user_uniq').on(t.userId),
}));

// ── CONVERSATIONS ────────────────────────────────────────────

export const conversationSessions = pgTable('conversation_sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topic: text('topic'),
  cefrLevel: text('cefr_level').notNull().default('A1'),
  fluencyScore: real('fluency_score'),
  accuracyScore: real('accuracy_score'),
  vocabularyScore: real('vocabulary_score'),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
}, (t) => ({
  userIdx: index('conv_sessions_user_idx').on(t.userId),
}));

export const conversationMessages = pgTable('conversation_messages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sessionId: text('session_id').notNull().references(() => conversationSessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  translation: text('translation'),
  corrections: jsonb('corrections').$type<Array<{ original: string; corrected: string; rule: string }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  sessionIdx: index('conv_messages_session_idx').on(t.sessionId),
}));

// ── AI INSIGHTS ──────────────────────────────────────────────

export const aiInsights = pgTable('ai_insights', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  strengths: jsonb('strengths').$type<string[]>().notNull(),
  weaknesses: jsonb('weaknesses').$type<string[]>().notNull(),
  recommendations: jsonb('recommendations').$type<string[]>().notNull(),
  dataPoints: integer('data_points').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('ai_insights_user_idx').on(t.userId),
}));

// ── REMINDERS REMOVED ────────────────────────────────────────

export const wordBatches = pgTable('word_batches', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  wordCount: integer('word_count').notNull().default(0),
  learnedCount: integer('learned_count').notNull().default(0),
  practiceUnlocked: boolean('practice_unlocked').notNull().default(false),
  examUnlocked: boolean('exam_unlocked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('word_batches_user_idx').on(t.userId),
}));

export const wordBatchExams = pgTable('word_batch_exams', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  batchId: text('batch_id').notNull().references(() => wordBatches.id, { onDelete: 'cascade' }),
  score: real('score').notNull(),
  maxScore: real('max_score').notNull(),
  vocabAccuracy: real('vocab_accuracy'),
  genderAccuracy: real('gender_accuracy'),
  verbAccuracy: real('verb_accuracy'),
  timeSpent: integer('time_spent'),
  answers: jsonb('answers').$type<Array<{
    wordId: string;
    type: string;
    userAnswer: string;
    correctAnswer: string;
    correct: boolean;
  }>>().notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (t) => ({
  userBatchIdx: index('wbe_user_batch_idx').on(t.userId, t.batchId),
}));

export const questionSnapshots = pgTable('question_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId: text('word_id').notNull().references(() => userWords.id, { onDelete: 'cascade' }),
  questionType: text('question_type').notNull(),
  prompt: text('prompt').notNull(),
  correctAnswer: text('correct_answer').notNull(),
  explanation: text('explanation'),
  context: text('context'),
  usedAt: timestamp('used_at').defaultNow().notNull(),
}, (t) => ({
  userWordIdx: index('qs_user_word_idx').on(t.userId, t.wordId),
}));

export const resetLogs = pgTable('reset_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resetType: text('reset_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── FIXED EXPRESSIONS ────────────────────────────────────────

export const userExpressions = pgTable('user_expressions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expression: text('expression').notNull(),
  meaning: text('meaning').notNull(),
  literalTranslation: text('literal_translation'),
  register: text('register'),
  cefrLevel: text('cefr_level').notNull().default('A1'),
  exampleSentence: text('example_sentence'),
  usageNote: text('usage_note'),
  category: text('category'),
  learned: boolean('learned').notNull().default(false),
  batchId: text('batch_id'),
  stability: real('stability').notNull().default(0),
  difficulty: real('difficulty').notNull().default(0),
  scheduledDays: real('scheduled_days').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  state: integer('state').notNull().default(0),
  lastReview: timestamp('last_review'),
  nextReview: timestamp('next_review').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userExprIdx: index('user_expressions_user_idx').on(t.userId),
  userBatchIdx: index('user_expressions_batch_idx').on(t.batchId),
  userNextReviewIdx: index('user_expressions_next_review_idx').on(t.userId, t.nextReview),
  userCategoryIdx: index('user_expressions_category_idx').on(t.userId, t.category),
}));

export const expressionReviewLogs = pgTable('expression_review_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expressionId: text('expression_id').notNull().references(() => userExpressions.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  rating: integer('rating').notNull(),
  correct: boolean('correct').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
}, (t) => ({
  userReviewIdx: index('expr_review_user_idx').on(t.userId, t.reviewedAt),
}));

export const expressionBatches = pgTable('expression_batches', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  expressionCount: integer('expression_count').notNull().default(0),
  learnedCount: integer('learned_count').notNull().default(0),
  practiceUnlocked: boolean('practice_unlocked').notNull().default(false),
  examUnlocked: boolean('exam_unlocked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('expression_batches_user_idx').on(t.userId),
}));

export const expressionBatchExams = pgTable('expression_batch_exams', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  batchId: text('batch_id').notNull().references(() => expressionBatches.id, { onDelete: 'cascade' }),
  score: real('score').notNull(),
  maxScore: real('max_score').notNull(),
  meaningAccuracy: real('meaning_accuracy'),
  timeSpent: integer('time_spent'),
  answers: jsonb('answers').$type<Array<{
    expressionId: string;
    type: string;
    userAnswer: string;
    correctAnswer: string;
    correct: boolean;
  }>>().notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (t) => ({
  userBatchIdx: index('ebe_user_batch_idx').on(t.userId, t.batchId),
}));

// ── LISTENING ────────────────────────────────────────────────

export const listeningAttempts = pgTable('listening_attempts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cefrLevel: text('cefr_level').notNull(),
  difficulty: text('difficulty').notNull(),
  script: text('script').notNull(),
  newWordsUsed: jsonb('new_words_used').$type<string[]>().notNull().default([]),
  questions: jsonb('questions').$type<Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    type: string;
  }>>().notNull(),
  answers: jsonb('answers').$type<Array<{
    questionIndex: number;
    userAnswer: number | string;
    correct: boolean;
  }>>(),
  score: real('score'),
  maxScore: real('max_score'),
  timeSpent: integer('time_spent'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('listening_attempts_user_idx').on(t.userId, t.createdAt),
  levelIdx: index('listening_attempts_level_idx').on(t.userId, t.cefrLevel),
}));

// ── EXISTING TABLES (kept for exam system) ───────────────────

export const decks = pgTable('decks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  cefrLevel: text('cefr_level').notNull(),
  module: text('module').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cards = pgTable('cards', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  front: text('front').notNull(),
  back: text('back').notNull(),
  contextSentence: text('context_sentence'),
  explanation: text('explanation'),
  cefrLevel: text('cefr_level').notNull(),
  module: text('module').notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  levelModuleIdx: index('cards_level_module_idx').on(t.cefrLevel, t.module),
  deckIdx: index('cards_deck_idx').on(t.deckId),
}));

export const cardStates = pgTable('card_states', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  stability: real('stability').notNull().default(0),
  difficulty: real('difficulty').notNull().default(0),
  elapsedDays: real('elapsed_days').notNull().default(0),
  scheduledDays: real('scheduled_days').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  state: integer('state').notNull().default(0),
  lastReview: timestamp('last_review'),
  nextReview: timestamp('next_review').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userCardUniq: uniqueIndex('card_states_user_card_uniq').on(t.userId, t.cardId),
  userNextReviewIdx: index('card_states_user_next_review_idx').on(t.userId, t.nextReview),
  userStateIdx: index('card_states_user_state_idx').on(t.userId, t.state),
}));

export const reviewLogs = pgTable('review_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  state: integer('state').notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsed: real('elapsed').notNull(),
  scheduled: real('scheduled').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
}, (t) => ({
  userReviewedIdx: index('review_logs_user_reviewed_idx').on(t.userId, t.reviewedAt),
  cardIdx: index('review_logs_card_idx').on(t.cardId),
}));

export const examTemplates = pgTable('exam_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  cefrLevel: text('cefr_level').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const examTemplateSections = pgTable('exam_template_sections', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  templateId: text('template_id').notNull().references(() => examTemplates.id, { onDelete: 'cascade' }),
  section: text('section').notNull(),
  timeMinutes: integer('time_minutes').notNull(),
  instructions: text('instructions').notNull(),
  content: jsonb('content').notNull(),
  maxScore: integer('max_score').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({
  templateSectionIdx: index('ets_template_section_idx').on(t.templateId, t.section),
}));

export const examAttempts = pgTable('exam_attempts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull().references(() => examTemplates.id, { onDelete: 'cascade' }),
  cefrLevel: text('cefr_level').notNull(),
  setNumber: integer('set_number'),
  totalScore: real('total_score'),
  maxScore: real('max_score'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').notNull().default('in_progress'),
}, (t) => ({
  userStartedIdx: index('exam_attempts_user_started_idx').on(t.userId, t.startedAt),
  userSetIdx: index('exam_attempts_user_set_idx').on(t.userId, t.cefrLevel, t.setNumber),
}));

export const examSectionScores = pgTable('exam_section_scores', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  attemptId: text('attempt_id').notNull().references(() => examAttempts.id, { onDelete: 'cascade' }),
  section: text('section').notNull(),
  score: real('score'),
  maxScore: real('max_score').notNull(),
  answers: jsonb('answers'),
  feedback: jsonb('feedback'),
  questionSnapshot: jsonb('question_snapshot'),
  timeSpent: integer('time_spent'),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  attemptSectionUniq: uniqueIndex('ess_attempt_section_uniq').on(t.attemptId, t.section),
}));

// ── QUESTION BANK ─────────────────────────────────────────────

export const questionBank = pgTable('question_bank', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  cefrLevel: text('cefr_level').notNull(),
  skillType: text('skill_type').notNull(),
  questionText: text('question_text').notNull(),
  passage: text('passage'),
  options: jsonb('options').$type<string[]>(),
  correctAnswer: text('correct_answer').notNull(),
  explanation: text('explanation'),
  difficulty: text('difficulty').notNull().default('medium'),
  sourceType: text('source_type').notNull().default('ai_generated'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  levelSkillIdx: index('qb_level_skill_idx').on(t.cefrLevel, t.skillType),
  sourceIdx: index('qb_source_idx').on(t.sourceType),
}));

export const examSets = pgTable('exam_sets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  cefrLevel: text('cefr_level').notNull(),
  setNumber: integer('set_number').notNull(),
  isStatic: boolean('is_static').notNull().default(false),
  lesenSection: jsonb('lesen_section').$type<{
    passages: Array<{
      title: string;
      text: string;
      questions: Array<{
        id: string;
        text: string;
        options: string[];
        correctAnswer: string;
        explanation: string;
        type: string;
      }>;
    }>;
  }>(),
  hoerenSection: jsonb('hoeren_section').$type<{
    dialogues: Array<{
      title: string;
      script: string;
      questions: Array<{
        id: string;
        text: string;
        options: string[];
        correctAnswer: string;
        explanation: string;
        type: string;
      }>;
    }>;
  }>(),
  schreibenSection: jsonb('schreiben_section').$type<{
    prompts: Array<{
      id: string;
      type: string;
      situation: string;
      task: string;
      points: string[];
      wordLimit: number;
    }>;
  }>(),
  sprechenSection: jsonb('sprechen_section').$type<{
    tasks: Array<{
      id: string;
      type: string;
      topic: string;
      instructions: string;
      talkingPoints?: string[];
    }>;
  }>(),
  timeLimit: integer('time_limit').notNull().default(90),
  totalMarks: integer('total_marks').notNull().default(100),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  levelSetUniq: uniqueIndex('exam_sets_level_set_uniq').on(t.cefrLevel, t.setNumber),
  levelIdx: index('exam_sets_level_idx').on(t.cefrLevel),
}));

export const userExamSetSnapshots = pgTable('user_exam_set_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cefrLevel: text('cefr_level').notNull(),
  setNumber: integer('set_number').notNull(),
  examSetId: text('exam_set_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userSetUniq: uniqueIndex('user_set_snapshot_uniq').on(t.userId, t.cefrLevel, t.setNumber),
}));
