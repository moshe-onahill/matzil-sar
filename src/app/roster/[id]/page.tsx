import { createClient } from "@supabase/supabase-js";
import RosterMemberClient from "./RosterMemberClient";

export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [{ id: "build" }];
  const supabase = createClient(url, key);
  const { data } = await supabase.from("users").select("id");
  return (data ?? [{ id: "build" }]).map((row: { id: string }) => ({ id: row.id }));
}

export default function RosterMemberPage() {
  return <RosterMemberClient />;
}
