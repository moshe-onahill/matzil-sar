export const dynamic = "force-static";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "Missing credentials" }, { status: 500 });

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.from("fcm_tokens").select("user_id, platform, token, created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    count: data?.length ?? 0,
    tokens: (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      platform: r.platform,
      token_prefix: r.token?.slice(0, 16),
      created_at: r.created_at,
    })),
  });
}
