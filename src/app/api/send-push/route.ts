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
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const privateKey = rawKey
    .replace(/^["']|["']$/g, "")   // strip surrounding quotes
    .replace(/\\n/g, "\n");         // convert \n sequences to real newlines
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

  let body: { user_id?: string; title?: string; body?: string; url?: string; critical?: boolean; location?: string; sms?: boolean; sender_name?: string; sender_unit?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { user_id, title, body: msgBody, url, critical = false, location, sms: sendSms = false, sender_name, sender_unit } = body;
  if (!user_id || !title) {
    return NextResponse.json({ error: "Missing user_id or title" }, { status: 400 });
  }

  const results = { fcm: 0, vapid: 0, email: false, sms: false, errors: [] as string[], fcmConfigured: false, fcmTokensFound: 0 };

  // --- FCM (native iOS/Android) ---
  const fcmConfigured = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
  results.fcmConfigured = fcmConfigured;
  if (fcmConfigured) {
    try {
      const messaging = getMessaging(getFirebaseApp());
      const { data: tokens, error: tokenErr } = await supabaseAdmin
        .from("fcm_tokens").select("token, platform").eq("user_id", user_id);

      if (tokenErr) results.errors.push(`fcm_tokens query: ${tokenErr.message}`);
      results.fcmTokensFound = tokens?.length ?? 0;
      if (tokens && tokens.length > 0) {
        await Promise.all(tokens.map(async (row: { token: string; platform: string }) => {
          const message: Message = {
            token: row.token,
            // Data-only — no `notification` field so onMessageReceived always fires
            // (notification messages are handled by system in background, bypassing our service)
            data: {
              title,
              body: msgBody || "",
              url: url || "/",
              critical: critical ? "true" : "false",
              ...(location ? { location } : {}),
              ...(sender_name ? { sender_name } : {}),
              ...(sender_unit ? { sender_unit } : {}),
            },
            ...(row.platform === "ios" ? {
              apns: {
                headers: { "apns-priority": "10", "apns-push-type": "alert" },
                payload: {
                  aps: {
                    alert: { title, body: msgBody || "" },
                    sound: critical ? { critical: true, name: "default", volume: 1.0 } : "default",
                    badge: 1,
                    "interruption-level": critical ? "critical" : "active",
                    "content-available": 1,
                  },
                },
              },
            } : {
              android: {
                priority: "high" as const,
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
  if (sendSms) {
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
              Body: [
                `🚨 MATZIL SAR ALERT`,
                ``,
                title,
                msgBody || "",
                location ? `📍 ${location}` : "",
                sender_name ? `Sent by: ${[sender_name, sender_unit].filter(Boolean).join(" · ")}` : "",
                `Time: ${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto", hour12: true })}`,
                ``,
                `Open app for full details.`,
              ].filter(Boolean).join("\n"),
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
