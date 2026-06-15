import { supabase } from "@/lib/supabase";

async function getCurrentUserId(): Promise<string | null> {
  const { data: authData } = await supabase.auth.getUser();
  const email = authData.user?.email;
  if (!email) return null;
  const { data: user } = await supabase.from("users").select("id").ilike("email", email).maybeSingle();
  return user?.id ?? null;
}

export async function registerFcmToken(): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  const platform = Capacitor.getPlatform() as "ios" | "android";
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

  // Request permission
  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== "granted") return;

  // Get and save token
  const { token } = await FirebaseMessaging.getToken();
  if (!token) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  await supabase.from("fcm_tokens").upsert(
    { user_id: userId, token, platform },
    { onConflict: "user_id,platform" }
  );

  // Token refresh — keep the saved token current
  await FirebaseMessaging.addListener("tokenReceived", async (event) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase.from("fcm_tokens").upsert(
      { user_id: uid, token: event.token, platform },
      { onConflict: "user_id,platform" }
    );
  });

  // Foreground message — show a system tray notification so it appears
  // even when the app is in the foreground (Android suppresses FCM UI by default)
  await FirebaseMessaging.addListener("notificationReceived", async (event) => {
    const { title, body } = event.notification;
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === "granted") {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 100000),
            title: title ?? "Matzil SAR",
            body: body ?? "",
            extra: event.notification.data,
          }],
        });
      }
    } catch {
      // LocalNotifications not available — in-app popup via NotificationListener handles it
    }
  });

  // Notification tap — navigate to the relevant incident or URL
  await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
    const data = event.notification.data as Record<string, string> | undefined;
    if (data?.url) window.location.href = data.url;
  });
}
