"use client";

import { useEffect, useState } from "react";

type Step = "notify" | "fullscreen" | "dnd" | "done";

async function openChannelSettings() {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  await (Capacitor as any).Plugins.AlertSettings.openChannelSettings();
}

async function openFullScreenSettings() {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  await (Capacitor as any).Plugins.AlertSettings.openFullScreenIntentSettings();
}

async function needsFullScreenPermission(): Promise<boolean> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return false;
  const result = await (Capacitor as any).Plugins.AlertSettings.canUseFullScreenIntent();
  return result?.allowed === false;
}

export default function PushPermission() {
  const [step, setStep] = useState<Step>("done");
  const [busy, setBusy] = useState(false);
  const [isNative, setIsNative] = useState(false);

  async function computeStep() {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    setIsNative(true);

    const registered = localStorage.getItem("fcm-registered") === "1";
    if (!registered) { setStep("notify"); return; }

    const fullscreenDone = localStorage.getItem("fcm-fullscreen-done") === "1";
    if (!fullscreenDone && await needsFullScreenPermission()) { setStep("fullscreen"); return; }
    localStorage.setItem("fcm-fullscreen-done", "1");

    const dndDone = localStorage.getItem("fcm-dnd-done") === "1";
    if (!dndDone) { setStep("dnd"); return; }

    setStep("done");
  }

  useEffect(() => {
    void computeStep();
    let cleanup: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void computeStep();
      }).then(h => { cleanup = () => h.remove(); });
    });
    return () => cleanup?.();
  }, []);

  if (!isNative || step === "done") return null;

  async function enable() {
    setBusy(true);
    try {
      const { registerFcmToken } = await import("@/lib/push-notifications");
      await registerFcmToken();
    } catch { /* ignore */ }
    setBusy(false);
    void computeStep();
  }

  const banners: Record<Step, { icon: string; title: string; body: string; action: string; onAction: () => void; onSkip?: () => void }> = {
    notify: {
      icon: "🔔",
      title: "Enable notifications",
      body: "Get critical SAR alerts even when the app is closed",
      action: busy ? "Setting up…" : "Enable",
      onAction: () => void enable(),
    },
    fullscreen: {
      icon: "📲",
      title: "Allow app to appear on screen",
      body: "Opens the app automatically when a critical alert is sent",
      action: "Open Settings",
      onAction: async () => { await openFullScreenSettings(); localStorage.setItem("fcm-fullscreen-done", "1"); void computeStep(); },
      onSkip: () => { localStorage.setItem("fcm-fullscreen-done", "1"); void computeStep(); },
    },
    dnd: {
      icon: "🚨",
      title: "Override Do Not Disturb",
      body: "Allows critical alerts to sound even in silent or DND mode",
      action: "Open Settings",
      onAction: async () => { await openChannelSettings(); localStorage.setItem("fcm-dnd-done", "1"); void computeStep(); },
      onSkip: () => { localStorage.setItem("fcm-dnd-done", "1"); void computeStep(); },
    },
    done: { icon: "", title: "", body: "", action: "", onAction: () => {} },
  };

  const b = banners[step];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 flex items-center gap-4">
        <div className="text-2xl">{b.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-100">{b.title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{b.body}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          {b.onSkip && (
            <button onClick={b.onSkip} className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition">Skip</button>
          )}
          <button onClick={b.onAction} disabled={busy}
            className="rounded-lg bg-[#E94E1B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition hover:bg-orange-600">
            {b.action}
          </button>
        </div>
      </div>
    </div>
  );
}
