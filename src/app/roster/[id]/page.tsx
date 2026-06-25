import RosterProfileClient from "./RosterProfileClient";
export function generateStaticParams() { return [{ id: "_" }]; }
export default function Page() { return <RosterProfileClient />; }
