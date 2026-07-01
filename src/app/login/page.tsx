"use client";

import { useEffect, useState } from "react";
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
  const [showGoogle, setShowGoogle] = useState(false);

  useEffect(() => {
    setShowGoogle(!localStorage.getItem("google-setup-done"));
  }, []);

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

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `https://matzil-sar.vercel.app/auth/callback` },
    });
    if (error) setError(error.message);
  }

  async function sendReset() {
    if (!resetEmail.trim()) { setError("Enter your email address."); return; }
    setResetLoading(true);
    await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `https://matzil-sar.vercel.app/auth/callback?type=recovery`,
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
            {/* Google — first login only */}
            {showGoogle && (
              <>
                <button
                  onClick={() => void loginWithGoogle()}
                  className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-4 text-base font-semibold text-zinc-900 transition active:bg-zinc-100"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="text-xs text-zinc-600">or</span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
              </>
            )}

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
