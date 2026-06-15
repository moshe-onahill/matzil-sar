// Supabase Edge Function — drains pending notification_logs and delivers them via /api/send-push
// Deploy: supabase functions deploy send-notifications
// Invoke via Supabase cron (pg_cron) every 15 seconds, or via database webhook on INSERT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://matzil-sar.vercel.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch pending notifications
  const { data: logs, error } = await supabase
    .from("notification_logs")
    .select("id, user_id, title, body, related_incident_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!logs || logs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Mark all as "sending" to prevent double-delivery
  const ids = logs.map((l: any) => l.id);
  await supabase.from("notification_logs").update({ status: "sending" }).in("id", ids);

  let sent = 0;
  const failed: string[] = [];

  await Promise.all(
    logs.map(async (log: any) => {
      try {
        const url = log.related_incident_id ? `/incidents/${log.related_incident_id}` : "/";
        const res = await fetch(`${SITE_URL}/api/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: log.user_id,
            title: log.title,
            body: log.body ?? "",
            url,
          }),
        });

        if (res.ok) {
          await supabase.from("notification_logs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", log.id);
          sent++;
        } else {
          const err = await res.text();
          await supabase.from("notification_logs").update({ status: "failed", error: err }).eq("id", log.id);
          failed.push(log.id);
        }
      } catch (e: any) {
        await supabase.from("notification_logs").update({ status: "failed", error: e.message }).eq("id", log.id);
        failed.push(log.id);
      }
    })
  );

  return new Response(JSON.stringify({ sent, failed: failed.length }), { status: 200 });
});
