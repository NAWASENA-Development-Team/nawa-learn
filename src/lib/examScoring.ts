// src/lib/examScoring.ts
// Pure scoring + redaction rules for student-authored ("custom") exams.
//
// A custom exam is not rows in `questions`; it is one jsonb blob on
// `custom_exams.questions`, and the answer key sits *inside* each question. That
// makes the blob itself the secret: the moment it is serialised to a browser, the
// exam is over. So this module owns the two jobs that must never drift apart —
//
//   1. `toPublicExamQuestions` — the only shape a browser is allowed to receive
//   2. `gradeExam`             — the only place a submitted answer meets a key
//
// Keeping both here, with no database and no Next.js imports, is what makes them
// testable directly — the same reason `quizScoring.ts` exists. If the redactor
// ever stopped stripping `answerKey`, `tests/unit/examScoring.test.ts` fails
// before the leak can reach a route.
import { z } from "zod";

/** The option keys the exam builder writes. Kept as data so tests can iterate. */
export const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/** One question exactly as stored in `custom_exams.questions` (server-side only). */
export type StoredExamQuestion = {
  id: string;
  text: string;
  options: Record<string, string>;
  answerKey: string;
  explanation: string | null;
};

/** One question as a browser may see it: everything except `answerKey`. */
export type PublicExamQuestion = Omit<StoredExamQuestion, "answerKey">;

/**
 * What a browser is allowed to send when it finishes a custom exam.
 *
 * Only `examId` and `answers` — there is deliberately no `score`, no
 * `correctCount` and no `difficulty` field for a client to inflate. The score is
 * derived from the stored keys, never accepted.
 */
export const examSubmitSchema = z
  .object({
    examId: z.uuid(),
    answers: z.record(z.string().min(1).max(200), z.string().min(1).max(8)),
  })
  .strict();

export type ExamSubmitInput = z.infer<typeof examSubmitSchema>;

export type ExamGrade = {
  results: { questionId: string; correct: boolean; correctKey: string }[];
  correctCount: number;
  totalCount: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Keys that must never be copied onto the rebuilt `options` object.
 *
 * `options["__proto__"] = x` does not create a property — it walks the prototype
 * setter. The values here are always strings so the damage is limited, but the
 * copy loop is meant to be a whitelist rebuild and this keeps it one.
 */
const UNSAFE_OPTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Read the stored blob defensively.
 *
 * The column is `jsonb`, so the database guarantees nothing about its shape: a
 * row written before this module existed, or by a future client, can hold
 * anything at all. Anything that is not a usable question is dropped rather than
 * trusted, and `options` is rebuilt from scratch so a prototype-polluting key
 * cannot survive the round trip.
 */
function readStoredQuestions(raw: unknown): StoredExamQuestion[] {
  if (!Array.isArray(raw)) return [];

  const questions: StoredExamQuestion[] = [];
  for (const entry of raw) {
    const question = asRecord(entry);

    const id = typeof question.id === "string" ? question.id : "";
    const text = typeof question.text === "string" ? question.text : "";
    const answerKey = typeof question.answerKey === "string" ? question.answerKey : "";
    // A question with no key cannot be graded, and one with no id cannot be
    // matched to an answer — both are unusable, so neither is kept.
    if (!id || !text || !answerKey) continue;

    const options: Record<string, string> = {};
    for (const [key, value] of Object.entries(asRecord(question.options))) {
      if (typeof value === "string" && !UNSAFE_OPTION_KEYS.has(key)) options[key] = value;
    }

    questions.push({
      id,
      text,
      options,
      answerKey,
      explanation: typeof question.explanation === "string" ? question.explanation : null,
    });
  }
  return questions;
}

/**
 * The browser-safe projection of a stored exam.
 *
 * Returns a new object per question rather than deleting a field from the stored
 * one, so there is no path on which the key is merely shadowed and can come back
 * through a spread.
 */
export function toPublicExamQuestions(raw: unknown): PublicExamQuestion[] {
  return readStoredQuestions(raw).map(({ id, text, options, explanation }) => ({
    id,
    text,
    options,
    explanation,
  }));
}

/**
 * The reviewer's projection of a stored exam: everything, **including the key**.
 *
 * This is the one function that may hand a key to a browser, and it exists only
 * for `GET /api/exams/pending`, which is behind `requireReviewer()`. A reviewer
 * cannot judge a package without seeing which option it calls correct — approving
 * blind is how a wrong key reaches every student who takes the exam.
 *
 * It still rebuilds each question through `readStoredQuestions()` rather than
 * returning the raw jsonb, so an unusable row is dropped here too and the queue
 * never renders a question the grader would ignore.
 */
export function toReviewExamQuestions(raw: unknown): StoredExamQuestion[] {
  return readStoredQuestions(raw);
}

/**
 * Grade a submission against the stored keys.
 *
 * Every stored question produces a verdict, including the ones left blank — the
 * practice page counts `totalCount` against the exam length, so an unanswered
 * question has to come back as a wrong one rather than as absent. An answer for
 * an id the exam does not contain is ignored.
 */
export function gradeExam(raw: unknown, answers: Record<string, string>): ExamGrade {
  const results: ExamGrade["results"] = [];
  let correctCount = 0;

  for (const question of readStoredQuestions(raw)) {
    const correct = answers[question.id] === question.answerKey;
    if (correct) correctCount += 1;
    results.push({ questionId: question.id, correct, correctKey: question.answerKey });
  }

  return { results, correctCount, totalCount: results.length };
}
