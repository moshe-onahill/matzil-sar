import AdminEventClient from "./AdminEventClient";
export function generateStaticParams() { return [{ id: "_" }]; }
export default function Page() { return <AdminEventClient />; }
