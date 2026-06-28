import Link from "next/link";
import { notFound } from "next/navigation";
import s from "../../dash.module.css";
import { fetchCall, twinConfigured } from "@/lib/twin";
import { CallActions } from "./actions";

export const dynamic = "force-dynamic";

const money = (n: number | null | undefined) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—");
const yesno = (b: boolean | null) => (b === null ? "—" : b ? "Yes" : "No");
const txt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US") : "—");

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={s.field}>
      <div className={s.fieldLbl}>{label}</div>
      <div className={s.fieldVal}>{value}</div>
    </div>
  );
}

function buildCallStory(r: import("@/lib/types").CallRow): string {
  if (!r) return "";
  const lines: string[] = [];

  // Verification arc
  if (r.fmcsa_eligible === false) {
    lines.push("Carrier did not pass FMCSA authority check — call ended.");
    return lines.join(" ");
  }
  if (r.fmcsa_eligible) lines.push("FMCSA authority confirmed.");
  if (r.identity_verified) lines.push("Identity verified via OTP.");
  else if (r.failure_stage === "otp") {
    lines.push(`OTP verification failed (${r.otp_attempts ?? "?"} attempt${(r.otp_attempts ?? 0) > 1 ? "s" : ""}) — call ended.`);
    return lines.join(" ");
  }

  // Load + negotiation arc
  if (r.offered_load_id) {
    const lane = r.offered_lane || [r.req_origin, r.req_destination].filter(Boolean).join(" → ") || r.offered_load_id;
    lines.push(`Matched load on ${lane}${r.offered_equipment ? ` (${r.offered_equipment})` : ""}.`);
  } else if (r.failure_stage === "matching") {
    lines.push("No matching load found for requested lane/equipment.");
    return lines.join(" ");
  }

  if (r.outcome === "booked") {
    const rounds = r.negotiation_rounds ? ` in ${r.negotiation_rounds} round${r.negotiation_rounds > 1 ? "s" : ""}` : "";
    lines.push(`Deal agreed at ${money(r.agreed_rate)}${rounds}.`);
    if (r.margin) lines.push(`Margin: ${money(r.margin)}.`);
    if (r.max_buy && r.agreed_rate && r.agreed_rate > r.max_buy) lines.push("⚠ Rate exceeded ceiling.");
  } else if (r.outcome === "no_deal_price") {
    const rounds = r.negotiation_rounds ? `after ${r.negotiation_rounds} rounds` : "";
    const ask = r.carrier_initial_ask ? `, carrier asked ${money(r.carrier_initial_ask)}` : "";
    lines.push(`Price gap — no deal ${rounds}${ask}. Rep callback recommended.`);
  } else if (r.outcome === "booking_failed") {
    lines.push(`Agreement reached at ${money(r.agreed_rate)}, but TMS booking failed — manual follow-up needed.`);
  } else if (r.outcome === "abandoned") {
    lines.push("Call ended without completing the process.");
  }

  return lines.join(" ");
}

export default async function CallDetail({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  if (!twinConfigured()) return <main className={s.page}><div className={s.empty}>Twin gateway not configured.</div></main>;

  const r = await fetchCall(callId);
  if (!r) notFound();

  const dur = typeof r.duration_sec === "number" ? `${Math.floor(r.duration_sec / 60)}m ${r.duration_sec % 60}s` : "—";
  const story = buildCallStory(r);

  return (
    <main className={s.page}>
      <Link href="/" className={s.back}>← Back to dashboard</Link>
      <div className={s.header} style={{ marginTop: 8 }}>
        <div>
          <h1 className={s.title}>{txt(r.carrier_name)}</h1>
          <div className={s.subtitle}>MC {txt(r.mc_number)} · {when(r.started_at)} · {dur}</div>
        </div>
      </div>

      {story && (
        <div className={s.callStory}>{story}</div>
      )}

      {/* Ops actions (write back to Twin) */}
      <CallActions callId={r.call_id} flagged={!!r.flagged} carrierTag={r.carrier_tag ?? "none"} />

      <h2 className={s.h2}>Outcome</h2>
      <div className={s.detailGrid}>
        <Field label="Outcome" value={txt(r.outcome)} />
        <Field label="Failure stage" value={txt(r.failure_stage)} />
        <Field label="Booking ref" value={txt(r.booking_ref)} />
        <Field label="FMCSA eligible" value={yesno(r.fmcsa_eligible)} />
        <Field label="Identity verified" value={yesno(r.identity_verified)} />
        <Field label="OTP attempts" value={txt(r.otp_attempts)} />
      </div>

      <h2 className={s.h2}>Load &amp; lane</h2>
      <div className={s.detailGrid}>
        <Field label="Requested" value={[r.req_origin, r.req_destination].filter(Boolean).join(" → ") || "—"} />
        <Field label="Requested equipment" value={txt(r.req_equipment)} />
        <Field label="Offered load" value={txt(r.offered_load_id)} />
        <Field label="Offered lane" value={txt(r.offered_lane)} />
        <Field label="Offered equipment" value={txt(r.offered_equipment)} />
      </div>

      <h2 className={s.h2}>Rate &amp; margin <span className={s.note}>· internal — not shown to carriers</span></h2>
      <div className={s.detailGrid}>
        <Field label="Loadboard rate" value={money(r.loadboard_rate)} />
        <Field label="Carrier initial ask" value={money(r.carrier_initial_ask)} />
        <Field label="Agreed rate" value={money(r.agreed_rate)} />
        <Field label="Max buy (ceiling)" value={money(r.max_buy)} />
        <Field label="Margin" value={money(r.margin)} />
        <Field label="Negotiation rounds" value={txt(r.negotiation_rounds)} />
      </div>

      {(r.notes || r.recording_url) && (
        <>
          <h2 className={s.h2}>Audit</h2>
          {r.notes ? <Field label="Notes" value={r.notes} /> : null}
          {r.recording_url ? (
            <Field label="Recording / transcript" value={<a href={r.recording_url} target="_blank" rel="noreferrer" className={s.rowLink}>Open recording ↗</a>} />
          ) : null}
        </>
      )}
    </main>
  );
}
