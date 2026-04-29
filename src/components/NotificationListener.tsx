"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  related_incident_id: string | null;
  user_id: string;
};

export default function NotificationListener() {
  const [popup, setPopup] = useState<Notification | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("matzil-alert-sound-enabled");
    if (saved === "true") {
      setSoundEnabled(true);
    }
  }, []);

  function unlockSound() {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) {
      alert("Audio alerts are not supported on this device.");
      return;
    }

    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    window.localStorage.setItem("matzil-alert-sound-enabled", "true");
    setSoundEnabled(true);

    playAlertSound();
  }

  function ensureAudioContext() {
    if (audioContextRef.current) return audioContextRef.current;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;
    return ctx;
  }

  function playAlertSound() {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const beep = (start: number, frequency: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "square";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(
        0.25,
        ctx.currentTime + start + 0.02
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + start + 0.35
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(ctx.currentTime + start);
      oscillator.stop(ctx.currentTime + start + 0.4);
    };

    beep(0, 880);
    beep(0.5, 880);
    beep(1.0, 880);
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email;

      if (!email || !active) return;

      const { data: user } = await supabase
        .from("users")
        .select("id, is_on_duty")
        .ilike("email", email)
        .maybeSingle();

      if (!user?.id || !active) return;

      channel = supabase
        .channel(`notification-listener-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notification_logs",
          },
          (payload) => {
            const notification = payload.new as Notification;

            if (notification.user_id !== user.id) return;
            if (user.is_on_duty === false) return;

            setPopup(notification);

            if ("vibrate" in navigator) {
              navigator.vibrate([500, 200, 500, 200, 500]);
            }

            if (
              window.localStorage.getItem("matzil-alert-sound-enabled") ===
              "true"
            ) {
              playAlertSound();
            }

            setTimeout(() => {
              setPopup(null);
            }, 9000);
          }
        )
        .subscribe();
    }

    void init();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <>
      {!soundEnabled && (
        <button
          onClick={unlockSound}
          className="fixed bottom-24 left-4 z-[190] rounded-full bg-gray-900 px-4 py-2 text-xs text-white shadow-xl"
        >
          Enable Alert Sound
        </button>
      )}

      {popup && (
        <div className="fixed left-4 right-4 top-5 z-[200] mx-auto max-w-md overflow-hidden rounded-2xl border border-red-400 bg-red-700 text-white shadow-2xl">
          <div className="bg-red-900 px-4 py-2 text-xs font-bold uppercase tracking-wide">
            Dispatch Alert
          </div>

          <div className="p-4">
            <div className="text-lg font-bold leading-tight">{popup.title}</div>

            {popup.body && (
              <div className="mt-2 whitespace-pre-wrap text-sm text-red-50">
                {popup.body}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {popup.related_incident_id && (
                <button
                  onClick={() => {
                    window.location.href = `/incidents/${popup.related_incident_id}`;
                  }}
                  className="rounded-lg bg-black/30 px-4 py-2 text-sm font-semibold"
                >
                  Open Incident
                </button>
              )}

              <button
                onClick={() => setPopup(null)}
                className="rounded-lg bg-black/20 px-4 py-2 text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}