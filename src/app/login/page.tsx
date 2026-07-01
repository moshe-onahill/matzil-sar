"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [unitSuffix, setUnitSuffix] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function login() {
    const callSign = `M-${unitSuffix.trim()}`;
    if (!unitSuffix.trim() || !password) { setError("Enter your unit number and password."); return; }
    setLoading(true);
    setError("");

    const { data: matched } = await supabase
      .from("users")
      .select("email")
      .ilike("call_sign", callSign)
      .maybeSingle();

    if (!matched?.email) {
      setLoading(false);
      setError("Unit number not found.");
      return;
    }

    const { error: authErr } = await supabase.auth.signInWithPassword({ email: matched.email, password });
    if (authErr) { setLoading(false); setError(authErr.message); return; }

    const { data: userRow } = await supabase.from("users").select("id").eq("email", matched.email.toLowerCase()).maybeSingle();
    if (!userRow) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Access denied. Contact an admin.");
      return;
    }

    window.location.replace("/");
  }

  async function sendReset() {
    if (!resetEmail.trim()) { setError("Enter your email address."); return; }
    setResetLoading(true);
    await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setResetLoading(false);
    setResetSent(true);
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6">
      {/* Logo — upper half */}
      <div className="flex flex-1 items-center justify-center w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/matzil-logo.png" alt="Matzil SAR" className="w-56 max-w-[70vw] object-contain" />
      </div>

      {/* Form — lower portion */}
      <div className="w-full max-w-sm pb-16 space-y-4">
        {forgotOpen ? (
          <>
            <input
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendReset()}
              placeholder="Email address"
              type="email"
              autoComplete="email"
              className="w-full rounded-full bg-zinc-600 px-6 py-4 text-base text-black placeholder-zinc-800 outline-none"
            />
            {error && <p className="text-sm text-red-400 px-2">{error}</p>}
            {resetSent ? (
              <p className="text-sm text-[#E94E1B] px-2">Reset email sent — check your inbox.</p>
            ) : (
              <div className="flex justify-end">
                <button onClick={() => void sendReset()} disabled={resetLoading}
                  className="rounded-full bg-green-700 px-10 py-4 text-base font-bold text-black disabled:opacity-50 transition">
                  {resetLoading ? "Sending…" : "Send Link"}
                </button>
              </div>
            )}
            <button onClick={() => { setForgotOpen(false); setResetSent(false); setError(""); }}
              className="text-sm text-[#E94E1B]">
              ← Back to Login
            </button>
          </>
        ) : (
          <>
            {/* Unit Number */}
            <div className="flex items-center rounded-full bg-zinc-600 px-6 py-4">
              <span className="text-base font-bold text-zinc-800 select-none mr-1">M-</span>
              <input
                value={unitSuffix}
                onChange={(e) => setUnitSuffix(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && void login()}
                placeholder="Unit Number"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                className="flex-1 bg-transparent text-base text-black placeholder-zinc-800 outline-none"
              />
            </div>

            {/* Password */}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full rounded-full bg-zinc-600 px-6 py-4 text-base text-black placeholder-zinc-800 outline-none"
            />

            {/* Forgot Password */}
            <button onClick={() => { setForgotOpen(true); setError(""); }}
              className="text-sm text-[#E94E1B] px-1">
              Forgot Password
            </button>

            {error && <p className="text-sm text-red-400 px-2">{error}</p>}

            {/* Login button — right-aligned */}
            <div className="flex justify-end">
              <button onClick={() => void login()} disabled={loading}
                className="rounded-full bg-green-700 px-12 py-4 text-lg font-bold text-black disabled:opacity-50 transition active:bg-green-600">
                {loading ? "…" : "Login"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
