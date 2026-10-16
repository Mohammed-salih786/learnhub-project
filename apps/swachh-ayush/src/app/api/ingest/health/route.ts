import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedIngestRequest } from "@/lib/ingest-auth";
import { createDatabaseClient } from "@/lib/supabase";

const healthSignalSchema = z.object({
  wardId: z.string().uuid(),
  observedOn: z.string().date(),
  feverCases: z.number().int().nonnegative(),
  dengueCases: z.number().int().nonnegative().default(0),
  malariaCases: z.number().int().nonnegative().default(0),
  source: z.string().trim().min(1).max(80),
});

export async function POST(request: NextRequest) {
  if (!process.env.SWACHH_INGEST_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "SWACHH_INGEST_API_KEY is not configured." },
      { status: 503 },
    );
  }
  if (!isAuthorizedIngestRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized health-data request." },
      { status: 401 },
    );
  }

  const parsed = healthSignalSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      },
      { status: 400 },
    );
  }

  try {
    const db = createDatabaseClient();
    const { data, error } = await db
      .from("swachh_health_signals")
      .upsert(
        {
          ward_id: parsed.data.wardId,
          observed_on: parsed.data.observedOn,
          fever_cases: parsed.data.feverCases,
          dengue_cases: parsed.data.dengueCases,
          malaria_cases: parsed.data.malariaCases,
          source: parsed.data.source,
        },
        { onConflict: "ward_id,observed_on,source" },
      )
      .select("id, ward_id, observed_on")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, signal: data }, { status: 201 });
  } catch (error) {
    console.error("Failed to save anonymized health signal:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not save the aggregate health signal. Verify the ward and database.",
      },
      { status: 500 },
    );
  }
}
