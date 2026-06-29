import { supabase } from "@/lib/supabase";

const CRITICAL_CHANNEL_ID = "matzil_critical_v2";
const DEFAULT_CHANNEL_ID = "matzil_default";

async function getCurrentUserId(): Promise<string | null> {
  const { data: authData } = await supabase.auth.getUser();
  const email = authData.user?.email;
  if (!email) return null;
  const { data: user } = await supabase.from("users").select("id").ilike("email", email).maybeSingle();
  return user?.id ?? null;
}

async function setupNotificationChannels() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.createChannel({
    id: CRITICAL_CHANNEL_ID,
    name: "Critical Alerts",
    description: "High-priority SAR alerts that override Do Not Disturb",
    importance: 5,
    sound: "alert.mp3",
    vibration: true,
    visibility: 1,
    lights: true,
    lightColor: "#E94E1B",
    bypassDnd: true,
  });
  await LocalNotifications.createChannel({
    id: DEFAULT_CHANNEL_ID,
    name: "Matzil Notifications",
    description: "Standard SAR notifications",
    importance: 3,
    sound: "default",
    vibration: true,
    visibility: 1,
  });
}

export async function registerFcmToken(): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  const platform = Capacitor.getPlatform() as "ios" | "android";

  try { await setupNotificationChannels(); } catch { /* ignore */ }

  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== "granted") {
    console.warn("[FCM] Permission not granted:", receive);
    return;
  }

  const { token } = await FirebaseMessaging.getToken();
  if (!token) { console.warn("[FCM] No token returned"); return; }
  console.log("[FCM] Token:", token);

  const userId = await getCurrentUserId();
  if (!userId) { console.warn("[FCM] No userId — user not authenticated yet"); return; }

  const { error } = await supabase.from("fcm_tokens").upsert(
    { user_id: userId, token, platform },
    { onConflict: "user_id,platform" }
  );
  if (error) console.error("[FCM] Save error:", error.message);
  else console.log("[FCM] Token saved for user", userId);

  // Don't re-add listeners on every call — guard with a flag
  if ((globalThis as any).__fcmListenersAdded) return;
  (globalThis as any).__fcmListenersAdded = true;

  await FirebaseMessaging.addListener("tokenReceived", async (event) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase.from("fcm_tokens").upsert(
      { user_id: uid, token: event.token, platform },
      { onConflict: "user_id,platform" }
    );
  });

  // Foreground message — show local notification on correct channel
  await FirebaseMessaging.addListener("notificationReceived", async (event) => {
    const { title, body } = event.notification;
    const data = event.notification.data as Record<string, unknown> | undefined;
    const isCritical = data?.critical === "true" || data?.critical === true;
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === "granted") {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 100000),
            title: title ?? "Matzil SAR",
            body: body ?? "",
            channelId: isCritical ? CRITICAL_CHANNEL_ID : DEFAULT_CHANNEL_ID,
            sound: isCritical ? "alert.mp3" : "default",
            extra: data,
          }],
        });
      }
    } catch { /* realtime subscription handles in-app popup */ }
  });

  await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
    const data = event.notification.data as Record<string, string> | undefined;
    if (data?.url) window.location.href = data.url;
  });
}
