import IncidentDetailClient from "./IncidentDetailClient";
export function generateStaticParams() { return [{ id: "_" }]; }
export default function IncidentDetailPage() { return <IncidentDetailClient />; }
