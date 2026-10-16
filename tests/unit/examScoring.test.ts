// tests/unit/examScoring.test.ts
// The redactor and the grader are two halves of one security property: a browser
// may be *graded*, but it may never be *told the answers*. These tests pin both
// halves, because losing either one re-opens H13 silently.
import { describe, expect, it } from "vitest";
import {
  examSubmitSchema,
  gradeExam,
  toPublicExamQuestions,
  type StoredExamQuestion,
} from "@/lib/examScoring";

const STORED: StoredExamQuestion[] = [
  {
    id: "custom_1_q0",
    text: "2 + 2 = ?",
    options: { A: "3", B: "4", C: "5", D: "6", E: "7" },
    answerKey: "B",
    explanation: "Aritmetika dasar.",
  },
  {
    id: "custom_1_q1",
    text: "Ibu kota Indonesia?",
    options: { A: "Jakarta", B: "Bandung", C: "Surabaya", D: "Medan", E: "Makassar" },
    answerKey: "A",
    explanation: null,
  },
];

describe("toPublicExamQuestions", () => {
  it("keeps the question but drops the key", () => {
    const [first] = toPublicExamQuestions(STORED);

    expect(first).toEqual({
      id: "custom_1_q0",
      text: "2 + 2 = ?",
      options: { A: "3", B: "4", C: "5", D: "6", E: "7" },
      explanation: "Aritmetika dasar.",
    });
    // The strongest form of the assertion: not "the field is undefined" but
    // "the string never appears anywhere in what would be serialised".
    expect(JSON.stringify(toPublicExamQuestions(STORED))).not.toContain("answerKey");
  });

  it("returns a new object per question rather than the stored one", () => {
    const [publicQuestion] = toPublicExamQuestions(STORED);

    expect(publicQuestion).not.toBe(STORED[0]);
    expect(Object.hasOwn(publicQuestion, "answerKey")).toBe(false);
  });

  it("drops entries that could not be graded or matched", () => {
    const messy = [
      ...STORED,
      { id: "", text: "no id", options: { A: "x" }, answerKey: "A" },
      { id: "custom_1_q9", text: "", options: { A: "x" }, answerKey: "A" },
      { id: "custom_1_q8", text: "no key", options: { A: "x" } },
      null,
      "not an object",
    ];

    expect(toPublicExamQuestions(messy).map((q) => q.id)).toEqual(["custom_1_q0", "custom_1_q1"]);
  });

  it("survives a column that does not hold an array at all", () => {
    expect(toPublicExamQuestions(null)).toEqual([]);
    expect(toPublicExamQuestions(undefined)).toEqual([]);
    expect(toPublicExamQuestions({ nope: true })).toEqual([]);
    expect(toPublicExamQuestions("string")).toEqual([]);
  });

  it("rebuilds options instead of copying prototype keys", () => {
    const polluted = JSON.parse(
      '[{"id":"q","text":"t","answerKey":"A","options":{"A":"ok","__proto__":"boom"}}]',
    );

    const [publicQuestion] = toPublicExamQuestions(polluted);

    expect(Object.keys(publicQuestion.options)).toEqual(["A"]);
    expect(Object.getPrototypeOf(publicQuestion.options)).toBe(Object.prototype);
  });

  it("ignores non-string option values", () => {
    const [publicQuestion] = toPublicExamQuestions([
      { id: "q", text: "t", answerKey: "A", options: { A: "ok", B: 42 } },
    ]);

    expect(publicQuestion.options).toEqual({ A: "ok" });
  });
});

describe("gradeExam", () => {
  it("counts a correct answer and echoes the key for the review screen", () => {
    const grade = gradeExam(STORED, { custom_1_q0: "B", custom_1_q1: "A" });

    expect(grade.correctCount).toBe(2);
    expect(grade.totalCount).toBe(2);
    expect(grade.results).toEqual([
      { questionId: "custom_1_q0", correct: true, correctKey: "B" },
      { questionId: "custom_1_q1", correct: true, correctKey: "A" },
    ]);
  });

  it("scores an unanswered question as wrong, not as absent", () => {
    const grade = gradeExam(STORED, { custom_1_q0: "B" });

    expect(grade.totalCount).toBe(2);
    expect(grade.correctCount).toBe(1);
    expect(grade.results[1]).toEqual({ questionId: "custom_1_q1", correct: false, correctKey: "A" });
  });

  it("scores a wrong answer as wrong", () => {
    const grade = gradeExam(STORED, { custom_1_q0: "C", custom_1_q1: "E" });

    expect(grade.correctCount).toBe(0);
  });

  it("ignores answers for questions the exam does not contain", () => {
    const grade = gradeExam(STORED, {
      custom_1_q0: "B",
      "some-other-id": "A",
      "": "A",
    });

    expect(grade.results).toHaveLength(2);
    expect(grade.correctCount).toBe(1);
  });

  it("grades nothing when the stored blob is unusable", () => {
    expect(gradeExam(null, { x: "A" })).toEqual({ results: [], correctCount: 0, totalCount: 0 });
    expect(gradeExam({}, { x: "A" }).totalCount).toBe(0);
  });
});

describe("examSubmitSchema", () => {
  const valid = { examId: "3f1a5b2c-4d5e-4f60-8a9b-0c1d2e3f4a5b", answers: { q0: "A" } };

  it("accepts an exam id and answers", () => {
    expect(examSubmitSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a client that tries to send its own score", () => {
    const result = examSubmitSchema.safeParse({ ...valid, correctCount: 99, pointsAwarded: 999 });

    expect(result.success).toBe(false);
  });

  it("refuses an exam id that is not a uuid", () => {
    expect(examSubmitSchema.safeParse({ ...valid, examId: "custom_1" }).success).toBe(false);
  });
});
