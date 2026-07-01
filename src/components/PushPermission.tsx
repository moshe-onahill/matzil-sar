"use client";

import { useEffect, useState } from "react";

type Step = "notify" | "silent" | "dnd" | "overlay" | "done";

const FLAGS = {
  notify: "fcm-registered",
  silent: "fcm-silent-done",
  dnd: "fcm-dnd-done",
  overlay: "fcm-overlay-done",
};

async function plugin() {
  const { Capacitor } = await import("@capacitor/core");
  return (Capacitor as any).Plugins.AlertSettings;
}

async function overlayGranted(): Promise<boolean> {
  try { return (await (await plugin()).checkOverlayPermission()).granted === true; }
  catch { return true; }
}

export default function PushPermission() {
  const [step, setStep] = useState<Step>("done");
  const [busy, setBusy] = useState(false);
  const [native, setNative] = useState(false);

  async function computeStep() {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    setNative(true);
    if (localStorage.getItem(FLAGS.notify) !== "1") { setStep("notify"); return; }
    if (localStorage.getItem(FLAGS.silent) !== "1") { setStep("silent"); return; }
    if (localStorage.getItem(FLAGS.dnd) !== "1") { setStep("dnd"); return; }
    if (localStorage.getItem(FLAGS.overlay) !== "1" && !await overlayGranted()) { setStep("overlay"); return; }
    localStorage.setItem(FLAGS.overlay, "1");
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

  if (!native || step === "done") return null;

  async function enableNotifications() {
    setBusy(true);
    try {
      const { registerFcmToken } = await import("@/lib/push-notifications");
      await registerFcmToken();
    } catch { /* ignore */ }
    setBusy(false);
    void computeStep();
  }

  async function openSettings(method: string, flag: string) {
    try { await (await plugin())[method](); } catch { /* ignore */ }
    localStorage.setItem(flag, "1");
    void computeStep();
  }

  const STEPS: Record<Exclude<Step, "done">, {
    icon: string; title: string; body: string; action: string;
    onAction: () => void; skippable?: boolean;
  }> = {
    notify: {
      icon: "🔔",
      title: "Enable notifications",
      body: "Required to receive critical SAR alerts",
      action: busy ? "Setting up…" : "Enable",
      onAction: () => void enableNotifications(),
    },
    silent: {
      icon: "🔕",
      title: "Override silent mode",
      body: "Allows alerts to sound even when the phone is silenced",
      action: "Open Settings",
      onAction: () => void openSettings("openChannelSettings", FLAGS.silent),
      skippable: true,
    },
    dnd: {
      icon: "🚫",
      title: "DND exceptions",
      body: "Allow Matzil SAR to interrupt Do Not Disturb mode",
      action: "Open Settings",
      onAction: () => void openSettings("openDndSettings", FLAGS.dnd),
      skippable: true,
    },
    overlay: {
      icon: "📲",
      title: "Appear on top",
      body: "Shows the alert popup even when another app is open",
      action: "Open Settings",
      onAction: () => void openSettings("openOverlaySettings", FLAGS.overlay),
      skippable: true,
    },
  };

  const s = STEPS[step as Exclude<Step, "done">];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 safe-area-bottom">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 flex items-center gap-3">
        <div className="text-2xl shrink-0">{s.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-100">{s.title}</div>
          <div className="text-xs text-zinc-400 mt-0.5 leading-snug">{s.body}</div>
        </div>
        <div className="flex gap-2 shrink-0">
          {s.skippable && (
            <button
              onClick={() => { localStorage.setItem(FLAGS[step as keyof typeof FLAGS], "1"); void computeStep(); }}
              className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition">
              Skip
            </button>
          )}
          <button onClick={s.onAction} disabled={busy}
            className="rounded-lg bg-[#E94E1B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition hover:bg-orange-600">
            {s.action}
          </button>
        </div>
      </div>
    </div>
  );
}
