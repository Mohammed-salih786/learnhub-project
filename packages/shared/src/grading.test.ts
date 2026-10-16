import { describe, expect, it } from "vitest";

import { gradeTest, type GradingQuestion, type StudentAnswer } from "./grading";

const baseQuestions: GradingQuestion[] = [
  { id: "q1", type: "mcq_single", marks: 2, answerKey: 1 },
  { id: "q2", type: "mcq_multi", marks: 3, answerKey: [0, 2] },
  {
    id: "q3",
    type: "short_answer",
    marks: 5,
    answerKey: ["photosynthesis", "chlorophyll"],
    requiredMatchCount: 1
  }
];

describe("gradeTest — MCQ single", () => {
  it("awards marks for correct single choice", () => {
    const answers: StudentAnswer[] = [{ questionId: "q1", value: 1 }];
    const result = gradeTest([baseQuestions[0]], answers);
    expect(result.earnedMarks).toBe(2);
    expect(result.passed).toBe(true);
  });

  it("awards zero for wrong single choice", () => {
    const answers: StudentAnswer[] = [{ questionId: "q1", value: 0 }];
    const result = gradeTest([baseQuestions[0]], answers);
    expect(result.earnedMarks).toBe(0);
    expect(result.passed).toBe(false);
  });
});

describe("gradeTest — MCQ multi", () => {
  it("awards marks only when all correct options are selected with no extras", () => {
    const answers: StudentAnswer[] = [{ questionId: "q2", value: [0, 2] }];
    const result = gradeTest([baseQuestions[1]], answers);
    expect(result.earnedMarks).toBe(3);
    expect(result.passed).toBe(true);
  });

  it("awards zero when extra option is included", () => {
    const answers: StudentAnswer[] = [{ questionId: "q2", value: [0, 1, 2] }];
    const result = gradeTest([baseQuestions[1]], answers);
    expect(result.earnedMarks).toBe(0);
  });

  it("awards zero when one required option is missing", () => {
    const answers: StudentAnswer[] = [{ questionId: "q2", value: [0] }];
    const result = gradeTest([baseQuestions[1]], answers);
    expect(result.earnedMarks).toBe(0);
  });
});

describe("gradeTest — short answer", () => {
  it("matches keyword case-insensitively", () => {
    const answers: StudentAnswer[] = [{ questionId: "q3", value: "PHOTOSYNTHESIS is a process" }];
    const result = gradeTest([baseQuestions[2]], answers);
    expect(result.earnedMarks).toBe(5);
  });

  it("matches keyword ignoring punctuation", () => {
    const answers: StudentAnswer[] = [{ questionId: "q3", value: "chlorophyll, which is a pigment" }];
    const result = gradeTest([baseQuestions[2]], answers);
    expect(result.earnedMarks).toBe(5);
  });

  it("matches stemmed variants", () => {
    const q: GradingQuestion = {
      id: "q4",
      type: "short_answer",
      marks: 2,
      answerKey: ["running"],
      requiredMatchCount: 1
    };
    const answers: StudentAnswer[] = [{ questionId: "q4", value: "She was running quickly." }];
    const result = gradeTest([q], answers);
    expect(result.earnedMarks).toBe(2);
  });

  it("fails when no keyword is present", () => {
    const answers: StudentAnswer[] = [{ questionId: "q3", value: "I don't know the answer" }];
    const result = gradeTest([baseQuestions[2]], answers);
    expect(result.earnedMarks).toBe(0);
  });
});

describe("gradeTest — full test", () => {
  it("computes correct score percent and pass/fail", () => {
    const answers: StudentAnswer[] = [
      { questionId: "q1", value: 1 },          // 2/2 correct
      { questionId: "q2", value: [0, 2] },      // 3/3 correct
      { questionId: "q3", value: "photosynthesis happens in leaves" } // 5/5 correct
    ];
    const result = gradeTest(baseQuestions, answers);
    expect(result.totalMarks).toBe(10);
    expect(result.earnedMarks).toBe(10);
    expect(result.scorePercent).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("applies custom pass threshold", () => {
    const answers: StudentAnswer[] = [
      { questionId: "q1", value: 1 },   // 2/2
      { questionId: "q2", value: [0] }, // 0/3
      { questionId: "q3", value: "unknown" } // 0/5
    ];
    const result60 = gradeTest(baseQuestions, answers, 60);
    const result10 = gradeTest(baseQuestions, answers, 10);
    expect(result60.scorePercent).toBe(20);
    expect(result60.passed).toBe(false);
    expect(result10.passed).toBe(true);
  });

  it("handles missing answers gracefully", () => {
    const result = gradeTest(baseQuestions, []);
    expect(result.earnedMarks).toBe(0);
    expect(result.passed).toBe(false);
  });
});
