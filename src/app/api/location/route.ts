export const dynamic = "force-static";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabaseAdmin = getAdmin();
  try {
    const { data, error } = await supabaseAdmin
      .from("live_locations")
      .select(`id, user_id, incident_id, lat, lng, speed_mph, is_moving, updated_at, users(full_name, call_sign)`)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getAdmin();
  try {
    const body = await req.json();
    const { user_id, lat, lng, is_moving, speed_mph, incident_id } = body;

    if (!user_id || lat == null || lng == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Delete old row then insert fresh
    await supabaseAdmin.from("live_locations").delete().eq("user_id", user_id);

    const { error } = await supabaseAdmin.from("live_locations").insert({
      user_id,
      lat,
      lng,
      is_moving: is_moving ?? null,
      speed_mph: speed_mph ?? null,
      incident_id: incident_id ?? null,
      updated_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabaseAdmin = getAdmin();
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    await supabaseAdmin.from("live_locations").delete().eq("user_id", user_id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
