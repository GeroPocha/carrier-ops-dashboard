// Row shape of the Twin `calls` table (see docs/data-model.md).
export type Outcome =
  | "booked"
  | "no_deal_price"
  | "no_match"
  | "failed_fmcsa"
  | "failed_otp"
  | "abandoned"
  | "booking_failed";

export type FailureStage =
  | "none"
  | "greeting"
  | "fmcsa"
  | "otp"
  | "matching"
  | "negotiation"
  | "booking";

export type CarrierTag = "none" | "top" | "blocked";

export interface CallRow {
  call_id: string;
  environment: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  mc_number: string | null;
  carrier_name: string | null;
  fmcsa_eligible: boolean | null;
  identity_verified: boolean | null;
  otp_attempts: number | null;
  req_origin: string | null;
  req_destination: string | null;
  req_equipment: string | null;
  offered_load_id: string | null;
  offered_lane: string | null;
  offered_equipment: string | null;
  loadboard_rate: number | null;
  max_buy: number | null;            // ops-only — internal dashboard surface
  carrier_initial_ask: number | null;
  agreed_rate: number | null;
  negotiation_rounds: number | null;
  margin: number | null;
  outcome: Outcome | null;
  failure_stage: FailureStage | null;
  booking_ref: string | null;
  notes: string | null;
  recording_url: string | null;
  flagged: boolean | null;
  carrier_tag: CarrierTag | null;
}
