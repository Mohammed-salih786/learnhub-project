/**
 * Server-side grading logic for MCQ (single/multi) and short answer questions.
 * All grading MUST happen server-side only — this file is also imported from Edge Functions.
 */

export type QuestionType = "mcq_single" | "mcq_multi" | "short_answer";

export interface GradingQuestion {
  id: string;
  type: QuestionType;
  marks: number;
  /** MCQ: correct option indices. Short answer: array of accepted keyword strings. */
  answerKey: unknown;
  /** Short answer only: how many keywords must match */
  requiredMatchCount?: number;
}

export interface StudentAnswer {
  questionId: string;
  /** MCQ: index or array of indices. Short answer: string. */
  value: unknown;
}

export interface GradingResult {
  totalMarks: number;
  earnedMarks: number;
  scorePercent: number;
  passed: boolean;
  passThreshold: number;
  breakdown: Array<{
    questionId: string;
    earned: number;
    possible: number;
    correct: boolean;
  }>;
}

/** Normalise a string for keyword comparison: lowercase, strip punctuation/extra whitespace. */
function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Very simple stemmer: strips common English suffixes. */
function stem(word: string): string {
  return word
    .replace(/ing$/, "")
    .replace(/tion$/, "")
    .replace(/ed$/, "")
    .replace(/s$/, "")
    .replace(/er$/, "")
    .replace(/ly$/, "");
}

function tokenise(s: string): Set<string> {
  return new Set(
    normaliseText(s)
      .split(" ")
      .filter(Boolean)
      .map(stem)
  );
}

function gradeShortAnswer(
  answer: unknown,
  answerKey: unknown,
  requiredMatchCount: number
): boolean {
  if (typeof answer !== "string") return false;

  let keywords: string[] = [];
  if (Array.isArray(answerKey)) {
    keywords = answerKey.filter((k): k is string => typeof k === "string");
  } else if (typeof answerKey === "string") {
    keywords = [answerKey];
  }

  if (keywords.length === 0) return false;

  const answerTokens = tokenise(answer);
  let matched = 0;

  for (const kw of keywords) {
    const kwTokens = tokenise(kw);
    // All tokens in the keyword phrase must be present (stemmed) in the answer
    const allPresent = [...kwTokens].every((t) => answerTokens.has(t));
    if (allPresent) matched++;
  }

  return matched >= requiredMatchCount;
}

function gradeMcqSingle(answer: unknown, answerKey: unknown): boolean {
  // answerKey: number (correct option index)
  const correct = typeof answerKey === "number" ? answerKey : parseInt(String(answerKey), 10);
  const given = typeof answer === "number" ? answer : parseInt(String(answer), 10);
  return !isNaN(correct) && !isNaN(given) && correct === given;
}

function gradeMcqMulti(answer: unknown, answerKey: unknown): boolean {
  // answerKey: number[] (all correct indices must be selected, no extras)
  const correctSet = new Set(
    (Array.isArray(answerKey) ? answerKey : [answerKey]).map((x) => Number(x))
  );
  const givenSet = new Set(
    (Array.isArray(answer) ? answer : [answer]).map((x) => Number(x))
  );
  if (correctSet.size !== givenSet.size) return false;
  for (const c of correctSet) {
    if (!givenSet.has(c)) return false;
  }
  return true;
}

/**
 * Grade a full test submission.
 * @param questions The question definitions with answer keys (from DB, server-side only)
 * @param answers The student's submitted answers
 * @param passThreshold Percentage required to pass (default 60)
 */
export function gradeTest(
  questions: GradingQuestion[],
  answers: StudentAnswer[],
  passThreshold = 60
): GradingResult {
  const answerMap = new Map<string, unknown>(
    answers.map((a) => [a.questionId, a.value])
  );

  let totalMarks = 0;
  let earnedMarks = 0;
  const breakdown: GradingResult["breakdown"] = [];

  for (const q of questions) {
    totalMarks += q.marks;
    const given = answerMap.get(q.id);
    let correct = false;

    switch (q.type) {
      case "mcq_single":
        correct = gradeMcqSingle(given, q.answerKey);
        break;
      case "mcq_multi":
        correct = gradeMcqMulti(given, q.answerKey);
        break;
      case "short_answer":
        correct = gradeShortAnswer(given, q.answerKey, q.requiredMatchCount ?? 1);
        break;
    }

    const earned = correct ? q.marks : 0;
    earnedMarks += earned;
    breakdown.push({ questionId: q.id, earned, possible: q.marks, correct });
  }

  const scorePercent = totalMarks === 0 ? 0 : Math.round((earnedMarks / totalMarks) * 100);
  return {
    totalMarks,
    earnedMarks,
    scorePercent,
    passed: scorePercent >= passThreshold,
    passThreshold,
    breakdown
  };
}
