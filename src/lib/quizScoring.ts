// src/lib/quizScoring.ts
// Pure scoring rules for quizzes: no database, no Next.js, no server imports.
//
// The rules used to live inline in the route handler, which made them
// impossible to test without spinning up the whole app. Keeping them here means
// tests/unit/quizScoring.test.ts can lock the behaviour down directly.
import { z } from "zod";

/**
 * What the server accepts from a browser when a quiz is submitted.
 *
 * Deliberately *only* `answers`. The old endpoint also accepted `difficulty`,
 * `score` and `quizId`, and trusted all three — which is how a single call with
 * `difficulty: "sangat sulit"` was worth 100 points. Anything else a client
 * sends is stripped by Zod and can never reach the scoring code.
 */
export const quizSubmitSchema = z.object({
  answers: z.record(z.string(), z.string().min(1).max(8)),
});

export type QuizSubmitInput = z.infer<typeof quizSubmitSchema>;

/** Reward for one correctly answered question, keyed by the DB difficulty. */
export const QUESTION_POINTS: Record<string, number> = {
  mudah: 5,
  sedang: 10,
  sulit: 15,
};

/** Used when a question carries a difficulty we do not know about. */
export const DEFAULT_QUESTION_POINTS = 5;

/** Guard against a single request trying to grade an absurd number of answers. */
export const MAX_ANSWERS_PER_SUBMISSION = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only real database ids can be graded. The sample quizzes hardcoded in the
 * practice page use ids like "q1", and student-built exams are not in the
 * `questions` table at all, so neither can be verified — and therefore neither
 * pays out.
 */
export function isGradeableQuestionId(id: string): boolean {
  return UUID_RE.test(id);
}

/** Points for a single graded answer. A wrong answer never pays out. */
export function pointsForAnswer(difficulty: string, correct: boolean): number {
  if (!correct) return 0;
  // `in`/bracket lookup alone would walk the prototype chain, so a difficulty of
  // "__proto__" or "constructor" would return an object instead of a number.
  // Own-property check keeps the return type honest for any input.
  if (!Object.hasOwn(QUESTION_POINTS, difficulty)) return DEFAULT_QUESTION_POINTS;
  return QUESTION_POINTS[difficulty];
}
