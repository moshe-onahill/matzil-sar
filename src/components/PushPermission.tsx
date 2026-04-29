"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PushPermission() {
  const [showButton, setShowButton] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void checkStatus();
  }, []);

  async function checkStatus() {
    if (!("serviceWorker" in navigator)) return;
    if (!("Notification" in window)) return;
    if (!("PushManager" in window)) return;

    const reg = await navigator.serviceWorker.register("/sw.js");
    const existingSub = await reg.pushManager.getSubscription();

    if (existingSub) {
      await saveSubscription(existingSub);
      setShowButton(false);
      return;
    }

    if (Notification.permission === "granted") {
      setShowButton(true);
      setMessage("Notifications allowed. Tap to finish setup.");
      return;
    }

    if (Notification.permission === "default") {
      setShowButton(true);
      setMessage("Enable phone notifications.");
      return;
    }

    if (Notification.permission === "denied") {
      setShowButton(false);
      setMessage("");
    }
  }

  async function enablePush() {
    try {
      setSaving(true);
      setMessage("Setting up notifications...");

      if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported.");
      }

      if (!("Notification" in window)) {
        throw new Error("Notifications are not supported.");
      }

      if (!("PushManager" in window)) {
        throw new Error("Push notifications are not supported.");
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
      }

      const reg = await navigator.serviceWorker.register("/sw.js");

      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      await saveSubscription(sub);

      setShowButton(false);
      setMessage("");
      alert("Phone notifications enabled.");
    } catch (err: any) {
      setMessage(err?.message || "Push setup failed.");
      alert(err?.message || "Push setup failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSubscription(sub: PushSubscription) {
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email;

    if (!email) {
      throw new Error("No logged-in email found.");
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (userError) {
      throw new Error(userError.message);
    }

    if (!user?.id) {
      throw new Error("No matching roster user found.");
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        subscription: sub.toJSON(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  if (!showButton) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[190] mx-auto max-w-md rounded-xl border border-gray-800 bg-gray-900 p-4 text-white shadow-xl">
      <div className="font-semibold">Phone Notifications</div>

      {message && <div className="mt-1 text-sm text-gray-400">{message}</div>}

      <button
        onClick={() => void enablePush()}
        disabled={saving}
        className="mt-3 w-full rounded bg-red-600 px-4 py-3 font-medium disabled:opacity-60"
      >
        {saving ? "Setting Up..." : "Enable Notifications"}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}