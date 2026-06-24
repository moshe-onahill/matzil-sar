import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  // Verify caller via JWT passed in Authorization header
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify the token and get the user
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check the user has an admin role
  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id);
  const roles = (roleData ?? []).flatMap((r: any) => {
    const role = r.roles;
    return Array.isArray(role) ? role.map((x: any) => x.name) : role?.name ? [role.name] : [];
  });
  const allowed = ["Global Admin", "SAR Manager", "Dispatcher"];
  if (!roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: { broadcast_id?: string; id?: string } = await req.json();

  if (body.broadcast_id) {
    const { error } = await supabaseAdmin
      .from("notification_logs")
      .delete()
      .eq("broadcast_id", body.broadcast_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (body.id) {
    const { error } = await supabaseAdmin
      .from("notification_logs")
      .delete()
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: "broadcast_id or id required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
