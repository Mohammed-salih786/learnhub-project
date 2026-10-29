import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: () => ({ toString: () => "learnhub_session=test-token" }) }));

import { apiFetch } from "./api";

describe("apiFetch", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("forwards the session cookie and returns JSON payloads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { id: "1" } }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(apiFetch("profile")).resolves.toMatchObject({ ok: true, data: { id: "1" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ headers: expect.any(Headers), cache: "no-store" }));
    expect((fetchMock.mock.calls[0][1]?.headers as Headers).get("cookie")).toBe("learnhub_session=test-token");
  });

  it("throws API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Not authorized" }), { status: 401, headers: { "content-type": "application/json" } }));
    await expect(apiFetch("profile")).rejects.toThrow("Not authorized");
  });
});
