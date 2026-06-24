import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  // Verify the caller is authenticated and has an admin role
  const cookieStore = await cookies();
  const supabaseUser = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check role
  const { data: roleData } = await supabaseUser
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
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
