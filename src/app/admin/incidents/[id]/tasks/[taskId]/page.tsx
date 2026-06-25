import AdminTaskClient from "./AdminTaskClient";
export function generateStaticParams() { return [{ id: "_", taskId: "_" }]; }
export default function Page() { return <AdminTaskClient />; }
