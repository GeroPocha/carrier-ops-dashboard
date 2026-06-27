// Minimal shared-password gate. The dashboard is served on a public URL and the
// Twin gateway trusts the org header alone, so we put our own auth in front.
// One env var: DASHBOARD_PASSWORD. The session cookie holds a SHA-256 derived
// token (never the password). Works in the edge middleware via Web Crypto.
export const COOKIE = "hr_dash_session";

export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`happyrobot-carrier-ops::${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
