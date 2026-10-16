import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { gradeTest, type GradingQuestion, type StudentAnswer } from "@learnhub/shared";
import {
  getTestWithQuestions,
  getTestAttemptCount,
  saveTestAttempt,
  getUserEntitlementContext
} from "@/lib/db";

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      value: z.unknown()
    })
  ).min(1, "At least one answer is required.")
});

// Trial users are limited to 1 attempt per test
const TRIAL_MAX_ATTEMPTS = 1;
const PAID_MAX_ATTEMPTS = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = request.cookies.get("learnhub_session")?.value;
  const isLocalDev = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost");

  if (!userId && !isLocalDev) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const testId = params.id;

  // Load test + questions (server-side — answer keys never sent to client)
  const test = await getTestWithQuestions(testId);
  if (!test) {
    return NextResponse.json({ ok: false, error: "Test not found." }, { status: 404 });
  }

  if (isLocalDev || !userId) {
    // Local dev: grade without attempt limits
    const questions: GradingQuestion[] = (test.questions ?? []).map((q: Record<string, unknown>) => ({
      id: q.id as string,
      type: q.question_type as "mcq_single" | "mcq_multi" | "short_answer",
      marks: (q.marks as number) ?? 1,
      answerKey: q.answer_key,
      requiredMatchCount: 1
    }));

    const answers: StudentAnswer[] = parsed.data.answers.map((a) => ({
      questionId: a.questionId,
      value: a.value
    }));

    const result = gradeTest(questions, answers);

    return NextResponse.json({
      ok: true,
      testId,
      ...result,
      message: result.passed ? "Well done! You passed." : "Keep practising — you can do better.",
      questions: (test.questions ?? []).map((q: Record<string, unknown>) => ({
        id: q.id,
        explanation: q.explanation
      }))
    });
  }

  // Check attempt limits
  const entitlement = await getUserEntitlementContext(userId!);
  const maxAttempts = entitlement?.hasActiveSubscription ? PAID_MAX_ATTEMPTS : TRIAL_MAX_ATTEMPTS;
  const attemptCount = await getTestAttemptCount(userId!, testId);

  if (attemptCount >= maxAttempts) {
    return NextResponse.json(
      {
        ok: false,
        error: entitlement?.hasActiveSubscription
          ? `You have reached the maximum of ${PAID_MAX_ATTEMPTS} attempts for this test.`
          : "Trial users can only attempt each test once. Upgrade to try again.",
        requiresSubscription: !entitlement?.hasActiveSubscription
      },
      { status: 429 }
    );
  }

  // Grade server-side — answer keys are loaded from DB and never exposed to the client
  const questions: GradingQuestion[] = (test.questions ?? []).map((q: Record<string, unknown>) => ({
    id: q.id as string,
    type: q.question_type as "mcq_single" | "mcq_multi" | "short_answer",
    marks: (q.marks as number) ?? 1,
    answerKey: q.answer_key,
    requiredMatchCount: 1
  }));

  const answers: StudentAnswer[] = parsed.data.answers.map((a) => ({
    questionId: a.questionId,
    value: a.value
  }));

  const result = gradeTest(questions, answers);

  // Persist attempt
  await saveTestAttempt({
    userId: userId!,
    testId,
    score: result.earnedMarks,
    scorePercent: result.scorePercent,
    passed: result.passed,
    breakdown: result.breakdown
  });

  return NextResponse.json({
    ok: true,
    testId,
    ...result,
    attemptsUsed: attemptCount + 1,
    attemptsRemaining: maxAttempts - attemptCount - 1,
    message: result.passed ? "Well done! You passed." : "Keep practising — you can do better.",
    // Only return explanations (not answer keys) so client can show them
    questions: (test.questions ?? []).map((q: Record<string, unknown>) => ({
      id: q.id,
      explanation: q.explanation
    }))
  });
}
