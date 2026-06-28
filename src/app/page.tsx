import Link from "next/link";
import s from "./dash.module.css";
import { fetchCalls, twinConfigured } from "@/lib/twin";
import {
  computeKpis,
  funnelStages,
  outcomeCounts,
  peakHeatmap,
  HEAT_DAYS,
  HEAT_BANDS,
} from "@/lib/kpis";
import type { CallRow, Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const dur = (sec: number | null | undefined) =>
  typeof sec === "number" ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : "—";
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

const OUTCOME_META: Record<Outcome, { color: string; soft: string; label: string }> = {
  booked: { color: "#2f7d56", soft: "#e7f1ea", label: "Booked" },
  no_deal_price: { color: "#b07d2b", soft: "#f6edd9", label: "No deal · price" },
  booking_failed: { color: "#aa3b2a", soft: "#f6e5e1", label: "Booking failed" },
  no_match: { color: "#5b6b7d", soft: "#e9edf1", label: "No match" },
  failed_otp: { color: "#aa3b2a", soft: "#f6e5e1", label: "Failed OTP" },
  failed_fmcsa: { color: "#86402f", soft: "#f0e3de", label: "Failed FMCSA" },
  abandoned: { color: "#a59c8c", soft: "#efe9de", label: "Abandoned" },
};

function OutcomeBadge({ o }: { o: Outcome | null }) {
  if (!o) return <span className={s.badge} style={{ background: "var(--paper-2)", color: "var(--muted)" }}>—</span>;
  const m = OUTCOME_META[o];
  return <span className={s.badge} style={{ background: m.soft, color: m.color }}>{m.label}</span>;
}

const ENVS = ["all", "production", "local"] as const;

function callSummary(r: CallRow): string {
  const parts: string[] = [];
  if (r.identity_verified) parts.push("verified");
  else if (r.fmcsa_eligible === false) parts.push("FMCSA rejected");
  if (r.offered_load_id) {
    const lane = r.offered_lane || [r.req_origin, r.req_destination].filter(Boolean).join("→");
    parts.push(`matched ${lane || r.offered_load_id}`);
  } else if (r.failure_stage === "matching") {
    parts.push("no load matched");
  }
  if (r.outcome === "no_deal_price") {
    const rounds = r.negotiation_rounds ? `after ${r.negotiation_rounds} rounds` : "";
    parts.push(`price gap ${rounds} — rep callback`);
  } else if (r.outcome === "booking_failed") {
    parts.push("TMS error after agreement");
  } else if (r.outcome === "failed_otp") {
    const attempts = r.otp_attempts && r.otp_attempts > 1 ? ` (${r.otp_attempts}×)` : "";
    parts.push(`OTP failed${attempts}`);
  }
  return parts.join(" · ") || "—";
}

function nextActionLabel(r: CallRow): string {
  if (r.outcome === "no_deal_price") return "Rep callback";
  if (r.outcome === "booking_failed") return "Review TMS error";
  if (r.otp_attempts && r.otp_attempts >= 3) return "Possible OTP fraud";
  return "Review flag";
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ env?: string }>;
}) {
  const { env = "all" } = await searchParams;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (!twinConfigured()) {
    return (
      <main className={s.shell}>
        <div className={s.warn}>
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
  const funnel = funnelStages(rows);
  const outcomes = outcomeCounts(rows);
  const heat = peakHeatmap(rows);

  const nearMissQueue = rows.filter((r) => r.outcome === "no_deal_price");
  const systemFailQueue = rows.filter((r) => r.outcome === "booking_failed");
  const flaggedQueue = rows.filter((r) => r.flagged && r.outcome !== "no_deal_price" && r.outcome !== "booking_failed");
  const totalActions = nearMissQueue.length + systemFailQueue.length + flaggedQueue.length;

  return (
    <main className={s.shell}>
      <header className={`${s.mast} ${s.reveal}`}>
        <div>
          <div className={s.kicker}>HappyRobot Logistics · Carrier Desk</div>
          <h1 className={s.mastTitle}>
            Carrier <em>Operations</em>
          </h1>
        </div>
        <div className={s.mastRight}>
          <span className={s.pulse}><span className={s.dot} /> Last logged from Twin</span>
          <span className={s.mastDate}>{today}</span>
          <div className={s.chips}>
            {ENVS.map((e) => (
              <Link key={e} href={`/?env=${e}`} className={`${s.chip} ${env === e ? s.chipOn : ""}`}>
                {e}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {error ? <div className={s.warn}>Couldn't reach Twin: {error}</div> : null}

      <section className={`${s.kpis} ${s.reveal}`} style={{ animationDelay: "60ms" }}>
        <div className={s.kpi}>
          <div className={s.kpiKicker}>Autonomous booking rate</div>
          <div className={`${s.kpiNum} ${s.clay}`}>{pct(k.conversion)}</div>
          <div className={s.kpiCtx}>{k.booked} of {k.total} inbound calls</div>
          <div className={s.kpiBar}><div className={s.kpiBarFill} style={{ width: `${Math.round(k.conversion * 100)}%` }} /></div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiKicker}>Avg margin / booked</div>
          <div className={`${s.kpiNum} ${s.forest}`}>{money(k.avgMargin)}</div>
          <div className={s.kpiCtx}>{money(k.totalMargin)} captured · {pct(k.avgMarginPct)} avg · {money(k.avgBelowLoadboard)} below list</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiKicker}>Avg handle time</div>
          <div className={s.kpiNum}>{k.avgDurationSec ? dur(k.avgDurationSec) : "—"}</div>
          <div className={s.kpiCtx}>≈ {k.hoursSaved.toFixed(1)} dispatcher-hrs handled · {pct(k.verifiedRate)} OTP pass</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiKicker}>Rate ceiling discipline</div>
          <div
            className={s.kpiNum}
            style={
              k.dealsWithCeiling === 0
                ? undefined
                : k.ceilingViolations === 0
                ? { color: "#2f7d56" }
                : { color: "#aa3b2a" }
            }
          >
            {k.dealsWithCeiling > 0
              ? k.ceilingViolations === 0 ? "0 violations" : `${k.ceilingViolations} breach`
              : "—"}
          </div>
          <div className={s.kpiCtx}>
            {k.dealsWithCeiling > 0
              ? `${k.nearCeilingDeals} near-ceiling · Ø ${k.avgRounds.toFixed(1)} rounds`
              : "No ceiling data yet"}
          </div>
        </div>
      </section>

      <section className={`${s.grid2} ${s.reveal}`} style={{ animationDelay: "120ms" }}>
        <div className={s.panel}>
          <div className={s.panelHead}>
            <div className={s.panelKicker}>Where carriers drop off</div>
            <h2 className={s.panelTitle}>Conversion funnel</h2>
          </div>
          <Funnel stages={funnel} />
        </div>
        <div className={s.panel}>
          <div className={s.panelHead}>
            <div className={s.panelKicker}>What happened</div>
            <h2 className={s.panelTitle}>Call outcomes</h2>
          </div>
          <OutcomeComposition items={outcomes} total={rows.length} />
        </div>
      </section>

      <section className={`${s.panel} ${s.reveal}`} style={{ marginTop: 18, animationDelay: "180ms" }}>
        <div className={s.panelHead}>
          <div className={s.panelKicker}>When the phones ring</div>
          <h2 className={s.panelTitle}>Call volume by day &amp; hour</h2>
          <div className={s.panelNote}>Plan staffing around the peaks — the brokerage's busiest windows are Monday morning and Friday afternoon.</div>
        </div>
        <Heatmap heat={heat} />
      </section>

      <section className={`${s.panel} ${s.reveal}`} style={{ marginTop: 18, animationDelay: "220ms" }}>
        <div className={s.panelHead}>
          <div className={s.panelKicker}>Needs attention</div>
          <h2 className={s.panelTitle}>
            Action queue
            {totalActions > 0 && (
              <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 700, background: "#f6e5e1", color: "#aa3b2a", padding: "2px 10px", borderRadius: 20 }}>
                {totalActions}
              </span>
            )}
          </h2>
          <div className={s.panelNote}>Recoverable near-misses, failed bookings &amp; flagged calls — each with recommended next action.</div>
        </div>
        {totalActions === 0 && <div className={s.empty}>Clear — no flagged calls or recoverable near-misses.</div>}
        {nearMissQueue.length > 0 && (
          <>
            <div className={s.queueLabel}>Near-misses — revenue recoverable via rep callback ({nearMissQueue.length})</div>
            <ActionTable rows={nearMissQueue} />
          </>
        )}
        {systemFailQueue.length > 0 && (
          <>
            <div className={s.queueLabel} style={{ color: "#aa3b2a" }}>TMS booking failures ({systemFailQueue.length})</div>
            <ActionTable rows={systemFailQueue} />
          </>
        )}
        {flaggedQueue.length > 0 && (
          <>
            <div className={s.queueLabel}>Flagged calls ({flaggedQueue.length})</div>
            <ActionTable rows={flaggedQueue} />
          </>
        )}
      </section>

      <section className={`${s.panel} ${s.reveal}`} style={{ marginTop: 18, animationDelay: "260ms" }}>
        <div className={s.panelHead}>
          <div className={s.panelKicker}>Audit trail</div>
          <h2 className={s.panelTitle}>Recent calls</h2>
        </div>
        {rows.length === 0 ? <div className={s.empty}>No calls logged yet.</div> : <CallTable rows={rows.slice(0, 40)} />}
      </section>
    </main>
  );
}

function Funnel({ stages }: { stages: { label: string; count: number }[] }) {
  const top = Math.max(1, stages[0]?.count ?? 1);
  return (
    <div className={s.funnel}>
      {stages.map((st, i) => {
        const prev = i > 0 ? stages[i - 1].count : st.count;
        const drop = prev > 0 ? Math.round(((prev - st.count) / prev) * 100) : 0;
        const isLast = i === stages.length - 1;
        return (
          <div className={s.fRow} key={st.label}>
            <span className={s.fLabel}>{st.label}</span>
            <span className={s.fBarWrap}>
              <span className={`${s.fBar} ${isLast ? s.last : ""}`} style={{ width: `${Math.max(6, (st.count / top) * 100)}%` }}>
                {st.count}
              </span>
            </span>
            <span className={s.fMeta}>{i === 0 ? "—" : drop > 0 ? <span className={s.fDrop}>−{drop}%</span> : "0%"}</span>
          </div>
        );
      })}
    </div>
  );
}

function OutcomeComposition({ items, total }: { items: { outcome: Outcome; count: number }[]; total: number }) {
  if (total === 0) return <div className={s.empty}>No outcomes yet.</div>;
  return (
    <div>
      <div className={s.ocomp}>
        {items.map((it) => (
          <div
            key={it.outcome}
            className={s.oseg}
            style={{ width: `${(it.count / total) * 100}%`, background: OUTCOME_META[it.outcome].color }}
            title={`${OUTCOME_META[it.outcome].label}: ${it.count}`}
          />
        ))}
      </div>
      <div className={s.olegend}>
        {items.map((it) => (
          <div className={s.oitem} key={it.outcome}>
            <span className={s.odot} style={{ background: OUTCOME_META[it.outcome].color }} />
            {OUTCOME_META[it.outcome].label}
            <span className={s.oc}>{it.count}</span>
            <span className={s.oPct}>{Math.round((it.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ heat }: { heat: { grid: number[][]; max: number; total: number } }) {
  if (heat.total === 0) return <div className={s.empty}>No timestamped calls yet.</div>;
  return (
    <div>
      <div className={s.heatBands}>
        {heat.grid.map((band, bi) => (
          <div className={s.heatRow} key={bi}>
            <span className={s.heatBandLabel}>{HEAT_BANDS[bi]}</span>
            {band.map((count, di) => {
              const intensity = heat.max ? count / heat.max : 0;
              const lit = count > 0;
              return (
                <span
                  key={di}
                  className={s.heatCell}
                  style={
                    lit
                      ? { backgroundColor: `rgba(192, 83, 43, ${0.2 + intensity * 0.8})`, color: intensity > 0.5 ? "#fff" : "var(--ink)" }
                      : undefined
                  }
                >
                  {lit ? count : ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className={s.heatDays}>
        <span />
        {HEAT_DAYS.map((d) => (
          <span className={s.heatDay} key={d}>{d}</span>
        ))}
      </div>
    </div>
  );
}

function ActionTable({ rows }: { rows: CallRow[] }) {
  return (
    <table className={s.table}>
      <thead>
        <tr>
          <th>When</th><th>Carrier</th><th>What happened</th><th>Next action</th>
          <th className={s.num}>Agreed</th><th className={s.num}>Margin</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.call_id}>
            <td>{when(r.started_at)}</td>
            <td>
              <Link className={s.carrier} href={`/calls/${r.call_id}`}>{r.carrier_name ?? "Unknown carrier"}</Link>
              <div className={s.sub}>MC {r.mc_number ?? "—"}</div>
            </td>
            <td style={{ fontSize: 12, color: "var(--ink-soft)", maxWidth: 260 }}>{callSummary(r)}</td>
            <td>
              <span className={s.badge} style={{ background: "#f6edd9", color: "#b07d2b", whiteSpace: "nowrap" }}>
                {nextActionLabel(r)}
              </span>
            </td>
            <td className={s.num}>{money(r.agreed_rate)}</td>
            <td className={s.num}>{money(r.margin)}</td>
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
          <th>When</th><th>Carrier</th><th>Lane</th><th>Outcome</th>
          <th className={s.num}>Agreed</th><th className={s.num}>Margin</th><th className={s.num}>Dur</th><th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.call_id}>
            <td>{when(r.started_at)}</td>
            <td>
              <Link className={s.carrier} href={`/calls/${r.call_id}`}>{r.carrier_name ?? "Unknown carrier"}</Link>
              <div className={s.sub}>MC {r.mc_number ?? "—"}</div>
            </td>
            <td>{r.offered_lane || [r.req_origin, r.req_destination].filter(Boolean).join(" → ") || "—"}</td>
            <td><OutcomeBadge o={r.outcome} /></td>
            <td className={s.num}>{money(r.agreed_rate)}</td>
            <td className={s.num}>{money(r.margin)}</td>
            <td className={s.num}>{dur(r.duration_sec)}</td>
            <td>{r.flagged ? <span className={s.flagMark}>⚑</span> : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
