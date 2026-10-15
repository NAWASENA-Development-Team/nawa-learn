import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUESTION_POINTS,
  isGradeableQuestionId,
  pointsForAnswer,
  quizSubmitSchema,
} from "@/lib/quizScoring";

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("quizSubmitSchema", () => {
  it("accepts an answer map", () => {
    const parsed = quizSubmitSchema.parse({ answers: { [UUID]: "A" } });
    expect(parsed.answers).toEqual({ [UUID]: "A" });
  });

  it("strips every field a client could use to influence the reward", () => {
    // This is the exact payload the old /api/quiz/complete endpoint was abused
    // with. It must parse successfully but carry nothing through.
    const parsed = quizSubmitSchema.parse({
      answers: { [UUID]: "A" },
      difficulty: "sangat sulit",
      score: 100,
      quizId: "anything-i-like",
      wrongAnswers: 0,
      pointsAwarded: 999999,
    });

    expect(parsed).toEqual({ answers: { [UUID]: "A" } });
    expect(Object.keys(parsed)).toEqual(["answers"]);
  });

  it("rejects a body without answers", () => {
    expect(quizSubmitSchema.safeParse({ difficulty: "sulit", score: 100 }).success).toBe(false);
    expect(quizSubmitSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-string option keys", () => {
    expect(quizSubmitSchema.safeParse({ answers: { [UUID]: 3 } }).success).toBe(false);
  });

  it("rejects an option key that is not a plausible answer", () => {
    expect(quizSubmitSchema.safeParse({ answers: { [UUID]: "" } }).success).toBe(false);
    expect(quizSubmitSchema.safeParse({ answers: { [UUID]: "ABCDEFGHI" } }).success).toBe(false);
  });
});

describe("isGradeableQuestionId", () => {
  it("accepts a database uuid", () => {
    expect(isGradeableQuestionId(UUID)).toBe(true);
    expect(isGradeableQuestionId(UUID.toUpperCase())).toBe(true);
  });

  it("rejects sample quiz ids hardcoded in the browser", () => {
    for (const id of ["q1", "q2", "quiz_physics", "quiz_mixed", "", "not-a-uuid", "3f2504e0"]) {
      expect(isGradeableQuestionId(id)).toBe(false);
    }
  });
});

describe("pointsForAnswer", () => {
  it("never pays for a wrong answer, whatever the difficulty says", () => {
    for (const difficulty of ["mudah", "sedang", "sulit", "sangat sulit", ""]) {
      expect(pointsForAnswer(difficulty, false)).toBe(0);
    }
  });

  it("pays by the difficulty stored in the database", () => {
    expect(pointsForAnswer("mudah", true)).toBe(5);
    expect(pointsForAnswer("sedang", true)).toBe(10);
    expect(pointsForAnswer("sulit", true)).toBe(15);
  });

  it("falls back for a difficulty it does not know, instead of throwing", () => {
    expect(pointsForAnswer("sangat sulit", true)).toBe(DEFAULT_QUESTION_POINTS);
    expect(pointsForAnswer("EXTREME", true)).toBe(DEFAULT_QUESTION_POINTS);
  });

  it("cannot be walked up the prototype chain to return a non-number", () => {
    for (const difficulty of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      const points = pointsForAnswer(difficulty, true);
      expect(typeof points).toBe("number");
      expect(Number.isFinite(points)).toBe(true);
      expect(points).toBe(DEFAULT_QUESTION_POINTS);
    }
  });

  it("never awards more than the hardest known difficulty", () => {
    const ceiling = Math.max(
      pointsForAnswer("mudah", true),
      pointsForAnswer("sedang", true),
      pointsForAnswer("sulit", true),
    );
    expect(pointsForAnswer("sangat sulit", true)).toBeLessThanOrEqual(ceiling);
  });
});
