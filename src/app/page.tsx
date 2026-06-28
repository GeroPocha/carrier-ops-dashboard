import Link from "next/link";
import s from "./dash.module.css";
import { fetchCalls, twinConfigured } from "@/lib/twin";
import { computeKpis, funnelStages, outcomeCounts } from "@/lib/kpis";
import type { CallRow, Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const dur = (sec: number) => `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const OUTCOME_CLASS: Record<Outcome, string> = {
  booked: s.booked,
  no_deal_price: s.near,
  booking_failed: s.fail,
  no_match: s.neutral,
  failed_otp: s.fail,
  failed_fmcsa: s.fail,
  abandoned: s.neutral,
};
function OutcomeBadge({ o }: { o: Outcome | null }) {
  if (!o) return <span className={`${s.badge} ${s.neutral}`}>—</span>;
  return <span className={`${s.badge} ${OUTCOME_CLASS[o]}`}>{o.replace(/_/g, " ")}</span>;
}

function Bars({ items, variant }: { items: { label: string; count: number }[]; variant?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div>
      {items.map((i) => (
        <div className={s.barRow} key={i.label}>
          <span className={s.barLabel}>{i.label}</span>
          <span className={s.barTrack}>
            <span className={`${s.barFill} ${variant ?? ""}`} style={{ width: `${(i.count / max) * 100}%` }} />
          </span>
          <span className={s.barCount}>{i.count}</span>
        </div>
      ))}
    </div>
  );
}

// One-line human summary of what happened on a call — for action queue triage.
function callSummary(r: CallRow): string {
  const parts: string[] = [];
  if (r.identity_verified) parts.push("verified");
  else if (r.fmcsa_eligible === false) parts.push("FMCSA rejected");
  else if (r.fmcsa_eligible) parts.push("FMCSA ok");

  if (r.offered_load_id) {
    const lane = r.offered_lane || [r.req_origin, r.req_destination].filter(Boolean).join("→");
    parts.push(`matched ${lane || r.offered_load_id}`);
  } else if (r.failure_stage === "matching") {
    parts.push("no load matched");
  }

  if (r.outcome === "no_deal_price") {
    const rounds = r.negotiation_rounds ? `after ${r.negotiation_rounds} rounds` : "";
    const ask = r.carrier_initial_ask ? `, ask ${money(r.carrier_initial_ask)}` : "";
    parts.push(`price gap ${rounds}${ask} — rep callback`);
  } else if (r.outcome === "booking_failed") {
    parts.push("TMS booking error after agreement");
  } else if (r.outcome === "failed_otp") {
    const attempts = r.otp_attempts && r.otp_attempts > 1 ? ` (${r.otp_attempts}x)` : "";
    parts.push(`OTP failed${attempts}`);
  }

  if (r.agreed_rate && r.max_buy && r.agreed_rate > r.max_buy) {
    parts.push("⚠ ceiling breach");
  }

  return parts.join(" · ") || "—";
}

// Recommended next action for action-queue rows.
function nextAction(r: CallRow): string {
  if (r.outcome === "no_deal_price") return "Rep callback";
  if (r.outcome === "booking_failed") return "Review TMS error";
  if (r.otp_attempts && r.otp_attempts >= 3) return "Possible OTP fraud";
  if (r.flagged) return "Review & resolve flag";
  return "Investigate";
}

const ENVS = ["all", "production", "local"] as const;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ env?: string }>;
}) {
  const { env = "all" } = await searchParams;

  if (!twinConfigured()) {
    return (
      <main className={s.page}>
        <div className={s.empty}>
          Twin gateway not wired yet. Deploy the app on the platform so{" "}
          <code>NEXT_PUBLIC_TWIN_GATEWAY</code> is injected, then reload.
        </div>
      </main>
    );
  }

  let all: CallRow[] = [];
  let error = "";
  try {
    all = await fetchCalls();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const rows = env === "all" ? all : all.filter((r) => (r.environment ?? "local") === env);
  const k = computeKpis(rows);

  // Action queue split by urgency type — mixed reasons make triage harder
  const nearMissQueue = rows.filter((r) => r.outcome === "no_deal_price");
  const systemFailQueue = rows.filter((r) => r.outcome === "booking_failed");
  const flaggedQueue = rows.filter((r) => r.flagged && r.outcome !== "no_deal_price" && r.outcome !== "booking_failed");
  const totalActions = nearMissQueue.length + systemFailQueue.length + flaggedQueue.length;

  return (
    <main className={s.page}>
      <div className={s.header}>
        <div>
          <div className={s.brand}>Happy<span className={s.dot}>Robot</span> Logistics</div>
          <h1 className={s.title}>Carrier Ops Dashboard</h1>
          <div className={s.subtitle}>Inbound carrier sales — last logged from Twin</div>
        </div>
        <div className={s.chips}>
          {ENVS.map((e) => (
            <Link key={e} href={`/?env=${e}`} className={`${s.chip} ${env === e ? s.chipActive : ""}`}>
              {e}
            </Link>
          ))}
        </div>
      </div>

      {error ? <div className={s.empty}>Couldn't reach Twin: {error}</div> : null}

      {/* KPIs */}
      <div className={s.kpiGrid}>
        <div className={s.kpi}>
          <div className={s.kpiNum}>{pct(k.conversion)}</div>
          <div className={s.kpiLbl}>Autonomous booking rate</div>
          <div className={s.kpiSub}>{k.booked} of {k.total} calls</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiNum}>{money(k.avgMargin)}</div>
          <div className={s.kpiLbl}>Avg margin / booked</div>
          <div className={s.kpiSub}>{money(k.totalMargin)} total · {pct(k.avgMarginPct)} avg · {money(k.avgBelowLoadboard)} below list</div>
        </div>
        <div className={s.kpi}>
          <div className={`${s.kpiNum} ${s.navy}`}>{k.avgDurationSec ? dur(k.avgDurationSec) : "—"}</div>
          <div className={s.kpiLbl}>Avg handle time</div>
          <div className={s.kpiSub}>≈ {k.hoursSaved.toFixed(1)} dispatcher-hrs handled · {pct(k.verifiedRate)} OTP pass</div>
        </div>
        <div className={s.kpi}>
          <div className={`${s.kpiNum} ${k.ceilingViolations === 0 ? s.ok : s.warn}`}>
            {k.dealsWithCeiling > 0 ? (k.ceilingViolations === 0 ? "0 violations" : `${k.ceilingViolations} breach`) : "—"}
          </div>
          <div className={s.kpiLbl}>Rate ceiling discipline</div>
          <div className={s.kpiSub}>
            {k.dealsWithCeiling > 0
              ? `${k.nearCeilingDeals} near-ceiling · Ø ${k.avgRounds.toFixed(1)} rounds`
              : "No ceiling data yet"}
          </div>
        </div>
      </div>

      {/* Funnel + outcomes */}
      <div className={s.twoCol}>
        <div>
          <h2 className={s.h2}>Conversion funnel</h2>
          <Bars items={funnelStages(rows)} variant={s.ok} />
        </div>
        <div>
          <h2 className={s.h2}>Outcomes</h2>
          <Bars items={outcomeCounts(rows).map((o) => ({ label: o.outcome.replace(/_/g, " "), count: o.count }))} variant={s.accent} />
        </div>
      </div>

      {/* Action queue — split by type */}
      <h2 className={s.h2}>
        Needs attention
        {totalActions > 0 && <span className={s.badge} style={{ marginLeft: 8, background: "#fdecec", color: "#b3261e" }}>{totalActions}</span>}
      </h2>

      {nearMissQueue.length > 0 && (
        <>
          <div className={s.queueLabel}>Near-misses — revenue recoverable via rep callback ({nearMissQueue.length})</div>
          <div className={s.card}>
            <ActionTable rows={nearMissQueue} />
          </div>
        </>
      )}

      {systemFailQueue.length > 0 && (
        <>
          <div className={s.queueLabel} style={{ color: "var(--warn)" }}>TMS booking failures — agreement reached, booking errored ({systemFailQueue.length})</div>
          <div className={s.card}>
            <ActionTable rows={systemFailQueue} />
          </div>
        </>
      )}

      {flaggedQueue.length > 0 && (
        <>
          <div className={s.queueLabel}>Flagged calls ({flaggedQueue.length})</div>
          <div className={s.card}>
            <ActionTable rows={flaggedQueue} />
          </div>
        </>
      )}

      {totalActions === 0 && (
        <div className={s.card}>
          <div className={s.empty}>Nothing in the queue — no flagged calls or recoverable near-misses.</div>
        </div>
      )}

      {/* Recent calls */}
      <h2 className={s.h2}>Recent calls</h2>
      <div className={s.card}>
        {rows.length === 0 ? <div className={s.empty}>No calls logged yet.</div> : <CallTable rows={rows.slice(0, 40)} />}
      </div>
    </main>
  );
}

function ActionTable({ rows }: { rows: CallRow[] }) {
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>When</th><th>Carrier / MC</th><th>What happened</th><th>Next action</th>
          <th className={s.num}>Agreed</th><th className={s.num}>Margin</th><th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.call_id}>
            <td>{when(r.started_at)}</td>
            <td>
              <Link className={s.rowLink} href={`/calls/${r.call_id}`}>
                {r.carrier_name ?? "Unknown"}
              </Link>
              {r.mc_number ? <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>MC {r.mc_number}</span> : null}
            </td>
            <td style={{ fontSize: 11.5, color: "var(--muted)", maxWidth: 280 }}>{callSummary(r)}</td>
            <td>
              <span className={`${s.badge} ${s.near}`}>{nextAction(r)}</span>
            </td>
            <td className={s.num}>{typeof r.agreed_rate === "number" ? `$${Math.round(r.agreed_rate).toLocaleString()}` : "—"}</td>
            <td className={s.num}>{typeof r.margin === "number" ? `$${Math.round(r.margin).toLocaleString()}` : "—"}</td>
            <td>{r.flagged ? <span className={s.flag}>⚑</span> : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CallTable({ rows }: { rows: CallRow[] }) {
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>When</th><th>Carrier</th><th>MC</th><th>Lane</th><th>Outcome</th>
          <th className={s.num}>Agreed</th><th className={s.num}>Margin</th><th className={s.num}>Dur</th><th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.call_id}>
            <td>{when(r.started_at)}</td>
            <td>
              <Link className={s.rowLink} href={`/calls/${r.call_id}`}>
                {r.carrier_name ?? "Unknown"}
              </Link>
            </td>
            <td>{r.mc_number ?? "—"}</td>
            <td>{r.offered_lane || [r.req_origin, r.req_destination].filter(Boolean).join(" → ") || "—"}</td>
            <td><OutcomeBadge o={r.outcome} /></td>
            <td className={s.num}>{money(r.agreed_rate)}</td>
            <td className={s.num}>{money(r.margin)}</td>
            <td className={s.num}>{typeof r.duration_sec === "number" ? dur(r.duration_sec) : "—"}</td>
            <td>{r.flagged ? <span className={s.flag}>⚑</span> : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
