import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST /api/tasks — create task or assign unit
export async function POST(req: NextRequest) {
  const admin = getAdmin();
  const body = await req.json();

  if (body.action === "create_task") {
    const { incident_id, task_number, description } = body;
    const { data, error } = await admin
      .from("incident_tasks")
      .insert({ incident_id, task_number, description: description || null, status: "Active" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === "assign_unit") {
    const { task_id, user_id } = body;
    const { error } = await admin
      .from("task_assignments")
      .upsert({ task_id, user_id }, { onConflict: "task_id,user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove_unit") {
    const { task_id, user_id } = body;
    const { error } = await admin
      .from("task_assignments")
      .delete()
      .eq("task_id", task_id)
      .eq("user_id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_lead") {
    const { task_id, user_id } = body;
    const { error } = await admin
      .from("incident_tasks")
      .update({ task_lead_id: user_id })
      .eq("id", task_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_status") {
    const { task_id, status } = body;
    const { error } = await admin
      .from("incident_tasks")
      .update({ status })
      .eq("id", task_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete_task") {
    const { task_id } = body;
    const { error } = await admin
      .from("incident_tasks")
      .delete()
      .eq("id", task_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
