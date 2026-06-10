import { supabase } from "@/lib/supabase";

export async function registerFcmToken(): Promise<void> {
  // Dynamically import Capacitor modules to avoid SSR errors
  const { Capacitor } = await import("@capacitor/core");

  if (!Capacitor.isNativePlatform()) return;

  const platform = Capacitor.getPlatform(); // "ios" | "android"

  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

  // Request permission
  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== "granted") return;

  // Get FCM token
  const { token } = await FirebaseMessaging.getToken();
  if (!token) return;

  // Get current user
  const { data: authData } = await supabase.auth.getUser();
  const email = authData.user?.email;
  if (!email) return;

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!user?.id) return;

  // Save token to Supabase
  await supabase.from("fcm_tokens").upsert(
    { user_id: user.id, token, platform },
    { onConflict: "user_id,platform" }
  );

  // Listen for foreground messages
  await FirebaseMessaging.addListener("notificationReceived", (event) => {
    const { title, body } = event.notification;
    console.log("FCM foreground:", title, body);
  });
}
