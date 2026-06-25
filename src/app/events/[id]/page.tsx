import EventDetailClient from "./EventDetailClient";
export function generateStaticParams() { return [{ id: "_" }]; }
export default function Page() { return <EventDetailClient />; }
