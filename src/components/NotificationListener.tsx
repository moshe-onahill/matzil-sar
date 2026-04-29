"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  related_incident_id: string | null;
  notification_type: string;
};

export default function NotificationListener() {
  const [popup, setPopup] = useState<Notification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelNameRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
    );

    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email;

      if (!email || !mounted) return;

      const { data: user } = await supabase
        .from("users")
        .select("id, is_on_duty")
        .ilike("email", email)
        .maybeSingle();

      if (!user?.id || !mounted) return;

      const channelName = `notification-popup-${user.id}`;

      if (channelNameRef.current) {
        await supabase.removeChannel(
          supabase.channel(channelNameRef.current)
        );
      }

      channelNameRef.current = channelName;

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notification_logs",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as Notification;

            if (user.is_on_duty === false) return;

            setPopup(n);

            if ("vibrate" in navigator) {
              navigator.vibrate([300, 150, 300]);
            }

            audioRef.current?.play().catch(() => {
              console.log("Audio blocked until user interacts with page.");
            });

            setTimeout(() => {
              setPopup(null);
            }, 8000);
          }
        );

      channel.subscribe();
    }

    void init();

    return () => {
      mounted = false;

      if (channelNameRef.current) {
        const channel = supabase
          .getChannels()
          .find((c) => c.topic === `realtime:${channelNameRef.current}`);

        if (channel) {
          void supabase.removeChannel(channel);
        }

        channelNameRef.current = null;
      }
    };
  }, []);

  if (!popup) return null;

  return (
    <div className="fixed left-4 right-4 top-6 z-[200] mx-auto max-w-md rounded-xl border border-red-400 bg-red-600 p-4 text-white shadow-xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-red-100">
        Dispatch Alert
      </div>

      <div className="mt-1 text-lg font-semibold">{popup.title}</div>

      {popup.body && (
        <div className="mt-1 text-sm text-red-100">{popup.body}</div>
      )}

      <div className="mt-3 flex gap-2">
        {popup.related_incident_id && (
          <button
            onClick={() => {
              window.location.href = `/incidents/${popup.related_incident_id}`;
            }}
            className="rounded bg-black/30 px-3 py-2 text-sm font-medium"
          >
            Open Incident
          </button>
        )}

        <button
          onClick={() => setPopup(null)}
          className="rounded bg-black/20 px-3 py-2 text-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}