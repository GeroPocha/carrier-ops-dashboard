import type { CallRow, Outcome } from "./types";

export interface Kpis {
  total: number;
  booked: number;
  conversion: number; // 0..1
  totalMargin: number;
  avgMargin: number;
  avgMarginPct: number; // 0..1
  avgBelowLoadboard: number; // posted − agreed, over booked
  verifiedRate: number; // verified / eligible
  avgDurationSec: number;
  avgRounds: number; // over calls that negotiated
  nearMisses: number; // no_deal_price
  flaggedCount: number;
  hoursSaved: number; // autonomous calls × avg handle time
}

const isNum = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function computeKpis(rows: CallRow[]): Kpis {
  const total = rows.length;
  const bookedRows = rows.filter((r) => r.outcome === "booked");
  const booked = bookedRows.length;

  const margins = bookedRows.map((r) => r.margin).filter(isNum);
  const marginPcts = bookedRows
    .filter((r) => isNum(r.margin) && isNum(r.agreed_rate) && r.agreed_rate! > 0)
    .map((r) => r.margin! / r.agreed_rate!);
  const belowLoadboard = bookedRows
    .filter((r) => isNum(r.loadboard_rate) && isNum(r.agreed_rate))
    .map((r) => r.loadboard_rate! - r.agreed_rate!);

  const eligible = rows.filter((r) => r.fmcsa_eligible).length;
  const verified = rows.filter((r) => r.identity_verified).length;

  const durations = rows.map((r) => r.duration_sec).filter(isNum);
  const rounds = rows.filter((r) => isNum(r.negotiation_rounds) && r.negotiation_rounds! > 0).map((r) => r.negotiation_rounds!);

  // "Autonomous" = the agent did real work (got past the greeting).
  const autonomous = rows.filter((r) => r.failure_stage && r.failure_stage !== "greeting");
  const hoursSaved = (mean(durations) * autonomous.length) / 3600;

  return {
    total,
    booked,
    conversion: total ? booked / total : 0,
    totalMargin: margins.reduce((a, b) => a + b, 0),
    avgMargin: mean(margins),
    avgMarginPct: mean(marginPcts),
    avgBelowLoadboard: mean(belowLoadboard),
    verifiedRate: eligible ? verified / eligible : 0,
    avgDurationSec: mean(durations),
    avgRounds: mean(rounds),
    nearMisses: rows.filter((r) => r.outcome === "no_deal_price").length,
    flaggedCount: rows.filter((r) => r.flagged).length,
    hoursSaved,
  };
}

// A true gate-by-gate funnel: how many calls cleared each stage.
export function funnelStages(rows: CallRow[]): { label: string; count: number }[] {
  const total = rows.length;
  const gaveMc = rows.filter((r) => r.mc_number).length;
  const eligible = rows.filter((r) => r.fmcsa_eligible).length;
  const verified = rows.filter((r) => r.identity_verified).length;
  const matched = rows.filter((r) => r.offered_load_id).length;
  const booked = rows.filter((r) => r.outcome === "booked").length;
  return [
    { label: "Inbound calls", count: total },
    { label: "Gave MC", count: gaveMc },
    { label: "FMCSA eligible", count: eligible },
    { label: "Identity verified", count: verified },
    { label: "Load matched", count: matched },
    { label: "Booked", count: booked },
  ];
}

const OUTCOME_ORDER: Outcome[] = [
  "booked",
  "no_deal_price",
  "booking_failed",
  "no_match",
  "failed_otp",
  "failed_fmcsa",
  "abandoned",
];

export function outcomeCounts(rows: CallRow[]): { outcome: Outcome; count: number }[] {
  const map = new Map<Outcome, number>();
  for (const r of rows) {
    if (!r.outcome) continue;
    map.set(r.outcome, (map.get(r.outcome) ?? 0) + 1);
  }
  return OUTCOME_ORDER.filter((o) => map.has(o)).map((o) => ({ outcome: o, count: map.get(o)! }));
}
