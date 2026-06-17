import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let body: { title?: string; message?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { title = "Security Alert", message = "", url = "/admin/audit" } = body;

  // Get all Global Admin user IDs
  const { data: admins } = await supabaseAdmin
    .from("users")
    .select("id, user_roles!inner(roles!inner(name))")
    .eq("user_roles.roles.name", "Global Admin");

  if (!admins || admins.length === 0) return NextResponse.json({ ok: true, notified: 0 });

  // Fire push to each admin via the send-push route
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://matzil-sar.vercel.app";
  await Promise.all(
    admins.map((admin: { id: string }) =>
      fetch(`${origin}/api/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: admin.id, title, body: message, url }),
      }).catch(() => null)
    )
  );

  return NextResponse.json({ ok: true, notified: admins.length });
}
