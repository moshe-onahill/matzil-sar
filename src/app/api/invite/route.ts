export const dynamic = "force-static";
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
  try {
    const { email, full_name } = await req.json();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? "" },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://matzil-sar.vercel.app"}/auth/callback`,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, user_id: data.user?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
