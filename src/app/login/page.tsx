"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

export default function LoginPage() {
  const toast = useToast();
  const [unitSuffix, setUnitSuffix] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  async function login() {
    const callSign = `M-${unitSuffix.trim()}`;
    if (!unitSuffix.trim() || !password) { toast("Enter your unit number and password.", "error"); return; }
    setLoading(true);

    const { data: matched } = await supabase
      .from("users")
      .select("email")
      .ilike("call_sign", callSign)
      .maybeSingle();

    if (!matched?.email) {
      setLoading(false);
      toast("Unit number not found.", "error");
      return;
    }

    const loginEmail = matched.email;
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) { setLoading(false); toast(error.message, "error"); return; }

    const { data: userRow } = await supabase.from("users").select("id").eq("email", loginEmail.toLowerCase()).maybeSingle();
    if (!userRow) {
      await supabase.auth.signOut();
      setLoading(false);
      toast("Access denied. Your account is not registered with Matzil SAR.", "error");
      void fetch("/api/alert-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "⚠️ Unknown Login Attempt", message: `Unregistered user tried to log in: ${loginEmail}`, url: "/admin/audit" }),
      });
      return;
    }

    setLoading(false);
    if (!rememberMe) {
      localStorage.setItem("session-temporary", "1");
      sessionStorage.setItem("session-active", "1");
    } else {
      localStorage.removeItem("session-temporary");
    }
    sessionStorage.removeItem("v2-mode");
    window.location.replace("/");
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast(error.message, "error");
  }

  async function sendReset() {
    if (!resetEmail.trim()) { toast("Enter your email address.", "error"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setLoading(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Password reset email sent — check your inbox.", "success");
    setMode("login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/matzil-logo.png" alt="Matzil SAR" width={72} height={88} className="object-contain" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Matzil SAR</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {mode === "login" ? "Sign in to your account" : "Reset your password"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm">
          {mode === "login" ? (
            <div className="space-y-3">
              {/* Google */}
              <button
                onClick={() => void loginWithGoogle()}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white active:bg-zinc-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs text-zinc-600">or</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              {/* Unit number with M- prefix */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Unit Number</label>
                <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-950 transition focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600">
                  <span className="pl-4 pr-1 text-sm font-semibold text-zinc-400 select-none">M-</span>
                  <input
                    value={unitSuffix}
                    onChange={(e) => setUnitSuffix(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && void login()}
                    placeholder="115"
                    type="text"
                    inputMode="numeric"
                    autoComplete="username"
                    className="flex-1 bg-transparent py-3 pr-4 text-sm text-zinc-50 placeholder-zinc-600 outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void login()}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder-zinc-600 outline-none transition focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none py-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 cursor-pointer accent-[#E94E1B]"
                />
                <span className="text-sm text-zinc-400">Remember me</span>
              </label>

              <button
                onClick={() => void login()}
                disabled={loading}
                className="w-full rounded-xl bg-[#E94E1B] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#E94E1B]/20 transition hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>

              <button
                onClick={() => setMode("forgot")}
                className="w-full pt-1 text-center text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                Forgot password?
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">Enter your email and we'll send a reset link.</p>

              <input
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendReset()}
                placeholder="Email address"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder-zinc-600 outline-none transition focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              />

              <button
                onClick={() => void sendReset()}
                disabled={loading}
                className="w-full rounded-xl bg-[#E94E1B] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#E94E1B]/20 transition hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>

              <button
                onClick={() => setMode("login")}
                className="w-full pt-1 text-center text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                ← Back to sign in
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-700">
          Access is by invitation only. Contact an admin to be added.
        </p>
      </div>
    </main>
  );
}
