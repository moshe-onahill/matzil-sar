"use client";

import { useEffect, useState } from "react";

export default function PushPermission() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      setIsNative(true);
      if (localStorage.getItem("fcm-registered") !== "1") setShow(true);

      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive && localStorage.getItem("fcm-registered") !== "1") setShow(true);
        });
      });
    });
  }, []);

  if (!isNative || !show) return null;

  async function enable() {
    setBusy(true);
    try {
      const { registerFcmToken } = await import("@/lib/push-notifications");
      await registerFcmToken();
      if (localStorage.getItem("fcm-registered") === "1") setShow(false);
    } catch { /* ignore */ }
    setBusy(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 flex items-center gap-4">
        <div className="text-2xl">🔔</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-100">Enable notifications</div>
          <div className="text-xs text-zinc-400 mt-0.5">Get critical SAR alerts even when the app is closed</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShow(false)}
            className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition">
            Later
          </button>
          <button onClick={() => void enable()} disabled={busy}
            className="rounded-lg bg-[#E94E1B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition hover:bg-orange-600">
            {busy ? "Setting up…" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}
