import DashboardClient from "./DashboardClient";
export function generateStaticParams() { return [{ id: "_" }]; }
export default function Page() { return <DashboardClient />; }
