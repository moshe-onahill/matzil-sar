"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MatzilLogo from "@/components/MatzilLogo";

export default function ResetPasswordPage() {
  const toast = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives via reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check if already in a session (e.g. after PKCE exchange in callback)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function save() {
    if (!password) { toast("Enter a new password.", "error"); return; }
    if (password.length < 6) { toast("Password must be at least 6 characters.", "error"); return; }
    if (password !== confirm) { toast("Passwords don't match.", "error"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Password updated. Redirecting…", "success");
    setTimeout(() => router.replace("/"), 1500);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <MatzilLogo size={64} />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Set New Password</h1>
            <p className="mt-1 text-sm text-zinc-500">Choose a new password for your account</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm">
          {!ready ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
              <p className="text-sm text-zinc-500">Verifying link…</p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void save()}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder-zinc-600 outline-none transition focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void save()}
                placeholder="Confirm password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder-zinc-600 outline-none transition focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
              />
              <button
                onClick={() => void save()}
                disabled={loading}
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-red-600/20 transition hover:bg-red-500 disabled:opacity-50"
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
