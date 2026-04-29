"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PushPermission() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void checkPermission();
  }, []);

  async function getCurrentRosterUserId() {
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email;

    if (!email) return null;

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    return user?.id ?? null;
  }

  async function savePermissionStatus(
    status: NotificationPermission | "unsupported"
  ) {
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email;

    if (!email) return;

    await supabase
      .from("users")
      .update({
        push_permission_status: status,
      })
      .ilike("email", email);
  }

  async function savePlaceholderPushToken() {
    const userId = await getCurrentRosterUserId();

    if (!userId) return;

    await supabase.from("user_push_tokens").insert({
      user_id: userId,
      token: "web-push-placeholder",
      platform: "web-pwa",
      is_active: true,
    });
  }

  async function checkPermission() {
    if (!("Notification" in window)) {
      await savePermissionStatus("unsupported");
      return;
    }

    await savePermissionStatus(Notification.permission);

    if (Notification.permission === "default") {
      setVisible(true);
    }

    if (Notification.permission === "granted") {
      await savePlaceholderPushToken();
    }
  }

  async function requestPermission() {
    if (!("Notification" in window)) {
      await savePermissionStatus("unsupported");
      setVisible(false);
      return;
    }

    const permission = await Notification.requestPermission();

    await savePermissionStatus(permission);

    if (permission === "granted") {
      await savePlaceholderPushToken();
    }

    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-28 left-4 right-4 z-[100] mx-auto max-w-md rounded-xl border border-gray-800 bg-gray-900 p-5 text-white shadow-xl">
      <div className="text-lg font-semibold">Enable Notifications</div>

      <div className="mt-2 text-sm text-gray-400">
        Get alerts for incidents, deployments, and important updates.
      </div>

      <button
        onClick={() => void requestPermission()}
        className="mt-4 w-full rounded bg-red-600 px-4 py-3 font-medium"
      >
        Enable Notifications
      </button>
    </div>
  );
}