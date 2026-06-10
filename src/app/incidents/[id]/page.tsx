import { createClient } from "@supabase/supabase-js";
import IncidentDetailClient from "./IncidentDetailClient";

export async function generateStaticParams() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from("incidents").select("id");
  return (data ?? []).map((row: { id: string }) => ({ id: row.id }));
}

export default function IncidentDetailPage() {
  return <IncidentDetailClient />;
}
