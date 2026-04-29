"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PushPermission() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function setupPush() {
      if (!("serviceWorker" in navigator)) return;

      const reg = await navigator.serviceWorker.register("/sw.js");

      // 🔥 CHECK IF ALREADY SUBSCRIBED
      const existingSub = await reg.pushManager.getSubscription();

      if (existingSub) {
        console.log("Already subscribed");
        setReady(true);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email;

      if (!email) return;

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (!user?.id) return;

      await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        subscription: sub,
      });

      console.log("Push subscription saved");

      setReady(true);
    }

    void setupPush();
  }, []);

  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}