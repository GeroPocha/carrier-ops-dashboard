import Link from "next/link";
import { notFound } from "next/navigation";
import s from "../../dash.module.css";
import { fetchCall, twinConfigured } from "@/lib/twin";
import { CallActions } from "./actions";

export const dynamic = "force-dynamic";

const money = (n: number | null) => (typeof n === "number" ? `$${n.toLocaleString("en-US")}` : "—");
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

  return (
    <main className={s.page}>
      <Link href="/" className={s.back}>← Back to dashboard</Link>
      <div className={s.header} style={{ marginTop: 8 }}>
        <div>
          <h1 className={s.title}>{txt(r.carrier_name)}</h1>
          <div className={s.subtitle}>MC {txt(r.mc_number)} · {when(r.started_at)} · {dur}</div>
        </div>
      </div>

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
