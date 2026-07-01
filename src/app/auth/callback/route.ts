export const dynamic = "force-dynamic";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      const user = data.session.user;
      const isRecovery = user.recovery_sent_at != null && searchParams.get("type") === "recovery";
      const isGoogle = user.app_metadata?.provider === "google";

      let next: string;
      if (isRecovery) {
        next = "/reset-password";
      } else if (isGoogle) {
        // Check if user already has a password set via service role
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: authUser } = await admin.auth.admin.getUserById(user.id);
        const hasPassword = !!(authUser?.user as any)?.encrypted_password;
        next = hasPassword ? "/" : "/reset-password?from=google";
      } else {
        next = searchParams.get("next") ?? "/";
      }

      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth`);
}
