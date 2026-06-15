"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

export default function LoginPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  async function login() {
    if (!email || !password) { toast("Enter your email and password.", "error"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { toast(error.message, "error"); return; }
    // Session is now in cookies — middleware will redirect /login → / on next navigation
    window.location.replace("/");
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function sendReset() {
    if (!email) { toast("Enter your email first.", "error"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Password reset email sent — check your inbox.", "success");
    setMode("login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm space-y-5">

        {/* Logo / brand */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="text-2xl font-bold">Matzil SAR</div>
          <div className="mt-1 text-sm text-gray-500">
            {mode === "login" ? "Sign in to your account" : "Reset your password"}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-900 p-6 space-y-3">
          {mode === "login" ? (
            <>
              {/* Google */}
              <button
                onClick={() => void loginWithGoogle()}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-700 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100 active:bg-gray-200"
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
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-600">or</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>

              {/* Email / password */}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void login()}
                placeholder="Email"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl bg-black px-4 py-3 text-sm placeholder-gray-600 outline-none focus:ring-1 focus:ring-red-600"
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void login()}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full rounded-xl bg-black px-4 py-3 text-sm placeholder-gray-600 outline-none focus:ring-1 focus:ring-red-600"
              />

              <button
                onClick={() => void login()}
                disabled={loading}
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold disabled:opacity-60 hover:bg-red-500"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>

              <button
                onClick={() => setMode("forgot")}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-300"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-400">
                Enter your email and we'll send a reset link.
              </div>

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendReset()}
                placeholder="Email"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl bg-black px-4 py-3 text-sm placeholder-gray-600 outline-none focus:ring-1 focus:ring-red-600"
              />

              <button
                onClick={() => void sendReset()}
                disabled={loading}
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>

              <button
                onClick={() => setMode("login")}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-300"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>

        <div className="text-center text-xs text-gray-700">
          Access is by invitation only. Contact an admin to be added.
        </div>
      </div>
    </main>
  );
}
