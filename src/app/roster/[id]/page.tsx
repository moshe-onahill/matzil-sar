import { createClient } from "@supabase/supabase-js";
import RosterMemberClient from "./RosterMemberClient";

export async function generateStaticParams() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from("users").select("id");
  return (data ?? []).map((row: { id: string }) => ({ id: row.id }));
}

export default function RosterMemberPage() {
  return <RosterMemberClient />;
}

