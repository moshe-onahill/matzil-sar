import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const vapidEmail = process.env.VAPID_EMAIL || "mailto:briefmoshe@gmail.com";
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "Missing VAPID keys" }, { status: 500 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server credentials" },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { user_id, title, body, url } = await req.json();

    if (!user_id || !title) {
      return NextResponse.json(
        { error: "Missing user_id or title" },
        { status: 400 }
      );
    }

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, message: "No subscriptions" });
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/",
    });

    await Promise.all(
      subs.map((s) =>
        webpush.sendNotification(s.subscription, payload).catch((err) => {
          console.error("Push error:", err);
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}