import { createClient } from "@supabase/supabase-js";
import IncidentDetailClient from "./IncidentDetailClient";

export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key);
  const { data } = await supabase.from("incidents").select("id");
  return (data ?? []).map((row: { id: string }) => ({ id: row.id }));
}

export default function IncidentDetailPage() {
  return <IncidentDetailClient />;
}

