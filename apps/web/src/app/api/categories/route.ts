import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const db = createServerSupabaseClient();
    const { data, error } = await db
      .from("categories")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, categories: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load categories.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
