import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { user_id, title, body: message, url } = body;

    if (!user_id || !title) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: subs, error } = await supabase
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
      body: message,
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}