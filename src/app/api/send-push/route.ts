export const dynamic = "force-static";

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

  let body: { user_id?: string; title?: string; body?: string; url?: string; critical?: boolean; location?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { user_id, title, body: msgBody, url, critical = false, location } = body;
  if (!user_id || !title) {
    return NextResponse.json({ error: "Missing user_id or title" }, { status: 400 });
  }

  const results = { fcm: 0, vapid: 0, email: false, sms: false, errors: [] as string[] };

  // --- FCM (native iOS/Android) ---
  const fcmConfigured = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;
  if (fcmConfigured) {
    try {
      const messaging = getMessaging(getFirebaseApp());
      const { data: tokens } = await supabaseAdmin
        .from("fcm_tokens").select("token, platform").eq("user_id", user_id);

      if (tokens && tokens.length > 0) {
        await Promise.all(tokens.map(async (row: { token: string; platform: string }) => {
          const message: Message = {
            token: row.token,
            notification: { title, body: msgBody || "" },
            data: { url: url || "/", critical: critical ? "true" : "false", ...(location ? { location } : {}) },
            ...(row.platform === "ios" ? {
              apns: {
                headers: critical ? { "apns-priority": "10" } : { "apns-priority": "5" },
                payload: {
                  aps: {
                    sound: critical
                      ? { critical: true, name: "default", volume: 1.0 }
                      : "default",
                    badge: 1,
                    "interruption-level": critical ? "critical" : "active",
                  },
                },
              },
            } : {
              android: {
                priority: "high" as const,
                notification: {
                  channelId: critical ? "matzil_critical" : "matzil_default",
                  sound: "default",
                  priority: critical ? "max" as const : "high" as const,
                  defaultSound: true,
                  defaultVibrateTimings: true,
                  notificationPriority: critical ? "PRIORITY_MAX" as const : "PRIORITY_HIGH" as const,
                },
              },
            }),
          };
          try { await messaging.send(message); results.fcm++; }
          catch (err: any) { results.errors.push(`FCM: ${err.message}`); }
        }));
      }
    } catch (err: any) { results.errors.push(`FCM setup: ${err.message}`); }
  }

  // --- VAPID web push ---
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || "mailto:briefmoshe@gmail.com";
  if (vapidPublicKey && vapidPrivateKey) {
    try {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions").select("subscription").eq("user_id", user_id);
      if (subs && subs.length > 0) {
        const payload = JSON.stringify({ title, body: msgBody || "", url: url || "/", critical });
        await Promise.all(subs.map((s: { subscription: any }) =>
          webpush.sendNotification(s.subscription, payload)
            .then(() => { results.vapid++; })
            .catch((err: any) => { results.errors.push(`VAPID: ${err.message}`); })
        ));
      }
    } catch (err: any) { results.errors.push(`VAPID setup: ${err.message}`); }
  }

  // --- Critical-only: Email + SMS ---
  if (critical) {
    // Get user contact info
    const { data: userRow } = await supabaseAdmin
      .from("users").select("email, phone").eq("id", user_id).single();

    // SMS via Twilio
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;
    if (twilioSid && twilioToken && twilioFrom && userRow?.phone) {
      try {
        const phone = userRow.phone.replace(/\D/g, "");
        const e164 = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: twilioFrom,
              To: e164,
              Body: `⚠️ CRITICAL ALERT — Matzil SAR\n${title}${msgBody ? `\n${msgBody}` : ""}${location ? `\n📍 ${location}` : ""}`,
            }).toString(),
          }
        );
        if (smsRes.ok) results.sms = true;
        else { const e = await smsRes.json(); results.errors.push(`SMS: ${e.message ?? smsRes.statusText}`); }
      } catch (err: any) { results.errors.push(`SMS: ${err.message}`); }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
