"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import s from "../dash.module.css";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace(next);
      router.refresh();
    } else {
      setErr("Incorrect password.");
    }
  }

  return (
    <main className={s.login}>
      <div className={s.loginCard}>
        <div className={s.kicker}>HappyRobot Logistics</div>
        <h1 className={s.loginTitle}>Carrier Desk</h1>
        <div className={s.loginSub}>Operations dashboard — sign in to continue.</div>
        <form onSubmit={submit}>
          <input
            className={s.input}
            type="password"
            placeholder="Dashboard password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className={s.loginBtn} disabled={busy} type="submit">
            {busy ? "…" : "Sign in"}
          </button>
        </form>
        <div className={s.err}>{err}</div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
