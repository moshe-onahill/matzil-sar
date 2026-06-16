import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const admin = getAdmin();
  const body = await req.json();

  if (body.action === "sign_in") {
    const { event_id, user_id, lat, lng } = body;
    const { error } = await admin.from("event_attendance").upsert(
      {
        event_id,
        user_id,
        signed_in_at: new Date().toISOString(),
        sign_in_lat: lat ?? null,
        sign_in_lng: lng ?? null,
        signed_out_at: null,
        sign_out_lat: null,
        sign_out_lng: null,
      },
      { onConflict: "event_id,user_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "sign_out") {
    const { event_id, user_id, lat, lng } = body;
    const { error } = await admin
      .from("event_attendance")
      .update({
        signed_out_at: new Date().toISOString(),
        sign_out_lat: lat ?? null,
        sign_out_lng: lng ?? null,
      })
      .eq("event_id", event_id)
      .eq("user_id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_invites") {
    const { event_id, user_ids } = body as { event_id: string; user_ids: string[] };
    await admin.from("event_invites").delete().eq("event_id", event_id);
    if (user_ids.length > 0) {
      const { error } = await admin
        .from("event_invites")
        .insert(user_ids.map((uid) => ({ event_id, user_id: uid })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
