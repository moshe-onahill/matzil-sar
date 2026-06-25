import AdminIncidentClient from "./AdminIncidentClient";
export function generateStaticParams() { return [{ id: "_" }]; }
export default function Page() { return <AdminIncidentClient />; }
