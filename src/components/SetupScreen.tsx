"use client";

import { useEffect, useState } from "react";

type StepId = "notify" | "silent" | "dnd" | "overlay" | "fullscreen";

const STEPS: { id: StepId; icon: string; title: string; body: string }[] = [
  { id: "notify",     icon: "🔔", title: "Enable Notifications",       body: "Receive critical SAR alerts even when the app is closed." },
  { id: "silent",     icon: "🔕", title: "Override Silent Mode",        body: "Alerts will sound even when your phone is silenced or vibrating." },
  { id: "dnd",        icon: "🚫", title: "Do Not Disturb Exceptions",   body: "Allow Matzil SAR to interrupt Do Not Disturb mode." },
  { id: "overlay",    icon: "📲", title: "Appear on Top",               body: "The app can display over other apps when an alert is sent." },
  { id: "fullscreen", icon: "🚨", title: "Full-Screen Notifications",   body: "Opens the app automatically on your screen when a critical alert is sent." },
];

const FLAGS: Record<StepId, string> = {
  notify:     "fcm-registered",
  silent:     "fcm-silent-done",
  dnd:        "fcm-dnd-done",
  overlay:    "fcm-overlay-done",
  fullscreen: "fcm-fullscreen-done",
};

async function alertPlugin() {
  const { Capacitor } = await import("@capacitor/core");
  return (Capacitor as any).Plugins.AlertSettings;
}

export default function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [done, setDone] = useState<Record<StepId, boolean>>({ notify: false, silent: false, dnd: false, overlay: false, fullscreen: false });
  const [busy, setBusy] = useState<StepId | null>(null);
  const [activeStep, setActiveStep] = useState<StepId>("notify");

  function refresh() {
    setDone({
      notify:  localStorage.getItem(FLAGS.notify)  === "1",
      silent:  localStorage.getItem(FLAGS.silent)  === "1",
      dnd:     localStorage.getItem(FLAGS.dnd)     === "1",
      overlay: localStorage.getItem(FLAGS.overlay) === "1",
    });
  }

  useEffect(() => {
    refresh();
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => { if (isActive) refresh(); });
    });
  }, []);

  // Auto-advance active step to first incomplete one
  useEffect(() => {
    // Auto-mark fullscreen done on Android < 14 (permission not needed)
    async function checkFullscreen() {
      try {
        const p = await alertPlugin();
        const result = await p.checkFullScreenPermission();
        if (result?.granted) localStorage.setItem(FLAGS.fullscreen, "1");
      } catch { localStorage.setItem(FLAGS.fullscreen, "1"); }
      refresh();
    }
    void checkFullscreen();
    const first = STEPS.find(s => !done[s.id]);
    if (first) setActiveStep(first.id);
  }, [done]);

  async function handleStep(id: StepId) {
    setBusy(id);
    try {
      if (id === "notify") {
        const { registerFcmToken } = await import("@/lib/push-notifications");
        await registerFcmToken();
      } else if (id === "silent") {
        await (await alertPlugin()).openChannelSettings();
        localStorage.setItem(FLAGS.silent, "1");
      } else if (id === "dnd") {
        await (await alertPlugin()).openDndSettings();
        localStorage.setItem(FLAGS.dnd, "1");
      } else if (id === "overlay") {
        await (await alertPlugin()).openOverlaySettings();
        localStorage.setItem(FLAGS.overlay, "1");
      } else if (id === "fullscreen") {
        await (await alertPlugin()).openFullScreenSettings();
        localStorage.setItem(FLAGS.fullscreen, "1");
      }
    } catch { /* ignore */ }
    setBusy(null);
    refresh();
  }

  function finish() {
    localStorage.setItem("setup-complete", "1");
    onComplete();
  }

  const allDone = STEPS.every(s => done[s.id]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-14 pb-6">
        <div className="text-2xl font-bold text-white mb-1">Welcome to Matzil SAR</div>
        <div className="text-sm text-zinc-400">Complete setup to receive critical alerts</div>
      </div>

      {/* Steps */}
      <div className="flex-1 px-4 space-y-3 overflow-y-auto">
        {STEPS.map((step) => {
          const isDone = done[step.id];
          const isActive = activeStep === step.id && !isDone;
          const isBusy = busy === step.id;

          return (
            <div key={step.id}
              className={`rounded-2xl border p-4 transition-all ${
                isDone ? "border-green-700/50 bg-green-900/20" :
                isActive ? "border-[#E94E1B]/60 bg-zinc-900" :
                "border-zinc-800 bg-zinc-900/50 opacity-60"
              }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                  isDone ? "bg-green-600 text-white" : isActive ? "bg-[#E94E1B] text-white" : "bg-zinc-700 text-zinc-400"
                }`}>
                  {isDone ? "✓" : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">{step.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 leading-snug">{step.body}</div>
                  {isActive && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => void handleStep(step.id)} disabled={isBusy}
                        className="rounded-lg bg-[#E94E1B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition hover:bg-orange-600">
                        {isBusy ? "Opening…" : step.id === "notify" ? "Enable" : "Open Settings"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-6 safe-area-bottom">
        <button onClick={finish} disabled={!allDone}
          className="w-full rounded-2xl bg-[#E94E1B] py-4 text-base font-bold text-white disabled:opacity-40 transition hover:bg-orange-600">
          {allDone ? "All Set — Enter App →" : "Complete all steps to continue"}
        </button>
        {!allDone && (
          <p className="text-center text-xs text-zinc-500 mt-3">All steps are required to receive SAR alerts</p>
        )}
      </div>
    </div>
  );
}
