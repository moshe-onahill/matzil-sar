export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let body: { broadcast_id?: string; id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  let error;
  if (body.broadcast_id) {
    ({ error } = await supabaseAdmin.from("notification_logs").delete().eq("broadcast_id", body.broadcast_id));
  } else if (body.id) {
    ({ error } = await supabaseAdmin.from("notification_logs").delete().eq("id", body.id));
  } else {
    return NextResponse.json({ error: "broadcast_id or id required" }, { status: 400 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
