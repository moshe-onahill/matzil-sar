"use client";

import { useEffect, useState } from "react";

type Step = "prompt" | "settings" | "done";

export default function PushPermission() {
  const [step, setStep] = useState<Step>("done");
  const [busy, setBusy] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      setIsNative(true);
      const registered = localStorage.getItem("fcm-registered") === "1";
      const settingsDone = localStorage.getItem("fcm-settings-done") === "1";
      if (!registered) setStep("prompt");
      else if (!settingsDone) setStep("settings");

      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) return;
          const reg = localStorage.getItem("fcm-registered") === "1";
          const set = localStorage.getItem("fcm-settings-done") === "1";
          if (!reg) setStep("prompt");
          else if (!set) setStep("settings");
          else setStep("done");
        });
      });
    });
  }, []);

  if (!isNative || step === "done") return null;

  async function enable() {
    setBusy(true);
    try {
      const { registerFcmToken } = await import("@/lib/push-notifications");
      await registerFcmToken();
      if (localStorage.getItem("fcm-registered") === "1") setStep("settings");
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function openSettings() {
    try {
      const { NativeSettings, AndroidSettings } = await import("capacitor-native-settings");
      await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
    } catch { /* ignore */ }
    localStorage.setItem("fcm-settings-done", "1");
    setStep("done");
  }

  if (step === "prompt") return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 flex items-center gap-4">
        <div className="text-2xl">🔔</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-100">Enable notifications</div>
          <div className="text-xs text-zinc-400 mt-0.5">Get critical SAR alerts even when the app is closed</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setStep("done")} className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition">Later</button>
          <button onClick={() => void enable()} disabled={busy}
            className="rounded-lg bg-[#E94E1B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition hover:bg-orange-600">
            {busy ? "Setting up…" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 flex items-center gap-4">
        <div className="text-2xl">🚨</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-100">Allow critical alerts</div>
          <div className="text-xs text-zinc-400 mt-0.5">Turn on Override Do Not Disturb so alerts sound even in silent mode</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { localStorage.setItem("fcm-settings-done", "1"); setStep("done"); }}
            className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition">Skip</button>
          <button onClick={() => void openSettings()}
            className="rounded-lg bg-[#E94E1B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600">
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}
