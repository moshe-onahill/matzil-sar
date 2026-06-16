import { supabase } from "@/lib/supabase";

export interface AuditEntry {
  action: string;
  entity_type?: string;
  entity_id?: string;
  entity_label?: string;
  details?: Record<string, unknown>;
}

/** Fire-and-forget audit log write. Never throws. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Try to get actor name from users table
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, call_sign, email")
      .eq("id", user.id)
      .single();

    const actor_name =
      (profile as { full_name?: string; call_sign?: string; email?: string } | null)?.call_sign ||
      (profile as { full_name?: string; call_sign?: string; email?: string } | null)?.full_name ||
      user.email ||
      user.id;

    await supabase.from("audit_log").insert({
      actor_id: user.id,
      actor_name,
      ...entry,
    });
  } catch {
    // audit failures must never break the main flow
  }
}
