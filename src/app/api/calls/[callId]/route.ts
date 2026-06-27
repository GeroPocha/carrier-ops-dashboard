import { NextResponse } from "next/server";
import { patchCall } from "@/lib/twin";
import type { CarrierTag } from "@/lib/types";

// Ops actions: flag a call / tag a carrier. Writes straight back to Twin.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    flagged?: boolean;
    carrier_tag?: CarrierTag;
  };

  const updates: { flagged?: boolean; carrier_tag?: CarrierTag } = {};
  if (typeof body.flagged === "boolean") updates.flagged = body.flagged;
  if (body.carrier_tag && ["none", "top", "blocked"].includes(body.carrier_tag)) {
    updates.carrier_tag = body.carrier_tag;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    const row = await patchCall(callId, updates);
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "twin error" },
      { status: 502 },
    );
  }
}
