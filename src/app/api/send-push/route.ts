import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { Message } from "firebase-admin/messaging";

export const runtime = "nodejs";

function getFirebaseApp() {
  if (getApps().length > 0) return getApp();

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase server credentials" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let body: { user_id?: string; title?: string; body?: string; url?: string; critical?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user_id, title, body: msgBody, url, critical = false } = body;

  if (!user_id || !title) {
    return NextResponse.json({ error: "Missing user_id or title" }, { status: 400 });
  }

  const results = { fcm: 0, vapid: 0, errors: [] as string[] };

  // --- FCM (native iOS/Android) ---
  const fcmConfigured =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  if (fcmConfigured) {
    try {
      const firebaseApp = getFirebaseApp();
      const messaging = getMessaging(firebaseApp);

      const { data: tokens } = await supabaseAdmin
        .from("fcm_tokens")
        .select("token, platform")
        .eq("user_id", user_id);

      if (tokens && tokens.length > 0) {
        await Promise.all(
          tokens.map(async (row: { token: string; platform: string }) => {
            const message: Message = {
              token: row.token,
              notification: { title, body: msgBody || "" },
              data: { url: url || "/" },
              ...(row.platform === "ios"
                ? {
                    apns: {
                      payload: {
                        aps: {
                          sound: critical
                            ? { critical: 1, name: "default", volume: 1.0 }
                            : "default",
                          badge: 1,
                        },
                      },
                    },
                  }
                : {
                    android: {
                      priority: "high" as const,
                      notification: { sound: "default", priority: "max" as const },
                    },
                  }),
            };

            try {
              await messaging.send(message);
              results.fcm++;
            } catch (err: any) {
              results.errors.push(`FCM: ${err.message}`);
            }
          })
        );
      }
    } catch (err: any) {
      results.errors.push(`FCM setup: ${err.message}`);
    }
  }

  // --- VAPID web push (keep existing web subscribers working) ---
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || "mailto:briefmoshe@gmail.com";

  if (vapidPublicKey && vapidPrivateKey) {
    try {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", user_id);

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({ title, body: msgBody || "", url: url || "/" });

        await Promise.all(
          subs.map((s: { subscription: any }) =>
            webpush.sendNotification(s.subscription, payload).then(() => {
              results.vapid++;
            }).catch((err: any) => {
              results.errors.push(`VAPID: ${err.message}`);
            })
          )
        );
      }
    } catch (err: any) {
      results.errors.push(`VAPID setup: ${err.message}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
