import EditIncidentClient from "./EditIncidentClient";
export function generateStaticParams() { return [{ id: "_" }]; }
export default function Page() { return <EditIncidentClient />; }
