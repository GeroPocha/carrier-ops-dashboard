"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import s from "../../dash.module.css";
import type { CarrierTag } from "@/lib/types";

export function CallActions({
  callId,
  flagged: initialFlagged,
  carrierTag: initialTag,
}: {
  callId: string;
  flagged: boolean;
  carrierTag: CarrierTag;
}) {
  const router = useRouter();
  const [flagged, setFlagged] = useState(initialFlagged);
  const [tag, setTag] = useState<CarrierTag>(initialTag);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  async function patch(updates: { flagged?: boolean; carrier_tag?: CarrierTag }) {
    setErr("");
    const res = await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      setErr("Update failed.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function toggleFlag() {
    const next = !flagged;
    setFlagged(next);
    if (!(await patch({ flagged: next }))) setFlagged(!next);
  }

  async function changeTag(next: CarrierTag) {
    const prev = tag;
    setTag(next);
    if (!(await patch({ carrier_tag: next }))) setTag(prev);
  }

  return (
    <div className={s.opsBar}>
      <button className={`${s.btn} ${flagged ? s.on : ""}`} onClick={toggleFlag} disabled={pending}>
        {flagged ? "⚑ Flagged" : "⚐ Flag for follow-up"}
      </button>
      <label className={s.fieldLbl} htmlFor="tag">Carrier tag</label>
      <select
        id="tag"
        className={s.select}
        value={tag}
        onChange={(e) => changeTag(e.target.value as CarrierTag)}
        disabled={pending}
      >
        <option value="none">None</option>
        <option value="top">Top carrier</option>
        <option value="blocked">Blocked</option>
      </select>
      {err ? <span className={s.err}>{err}</span> : null}
    </div>
  );
}
