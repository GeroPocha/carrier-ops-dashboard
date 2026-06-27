import "server-only";
import type { CallRow } from "./types";

// The Twin REST gateway is injected by the platform at deploy time. We only ever
// touch it from the server (route handlers / server components) — never the
// browser, since the gateway is bound to the org by the x-org-id header alone.
const GATEWAY = process.env.NEXT_PUBLIC_TWIN_GATEWAY;
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID;

export function twinConfigured(): boolean {
  return Boolean(GATEWAY && ORG_ID);
}

async function twinFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!GATEWAY || !ORG_ID) {
    throw new Error(
      "Twin gateway not configured (NEXT_PUBLIC_TWIN_GATEWAY / NEXT_PUBLIC_ORG_ID missing). " +
        "These are injected on deploy — run the app on the platform.",
    );
  }
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      "x-org-id": ORG_ID,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Twin gateway ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res;
}

// PostgREST-style query. We pull the recent window once and aggregate in JS —
// simple and plenty for the POC volume (~500 calls/week).
export async function fetchCalls(limit = 1000): Promise<CallRow[]> {
  const params = new URLSearchParams({
    order: "started_at.desc",
    limit: String(limit),
  });
  const res = await twinFetch(`/calls?${params.toString()}`);
  return (await res.json()) as CallRow[];
}

export async function fetchCall(callId: string): Promise<CallRow | null> {
  const res = await twinFetch(`/calls?call_id=eq.${encodeURIComponent(callId)}`);
  const rows = (await res.json()) as CallRow[];
  return rows[0] ?? null;
}

// Ops actions write straight back to Twin — no second store, one source of truth.
export async function patchCall(
  callId: string,
  updates: Partial<Pick<CallRow, "flagged" | "carrier_tag">>,
): Promise<CallRow | null> {
  const res = await twinFetch(`/calls?call_id=eq.${encodeURIComponent(callId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  const rows = (await res.json()) as CallRow[];
  return rows[0] ?? null;
}
