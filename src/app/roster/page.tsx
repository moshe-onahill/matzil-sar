import Link from "next/link";

export default function RosterPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-1">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Roster</h1>
          </div>

          <Link
            href="/"
            className="bg-gray-900 hover:bg-gray-800 border border-gray-800 px-4 py-2 rounded-xl text-sm"
          >
            Home
          </Link>
        </div>

        <div className="bg-gray-950 border border-gray-900 rounded-2xl p-5 mb-4">
          <h2 className="text-lg font-semibold mb-2">Member Management</h2>
          <p className="text-gray-400">
            This page will let admins manage the roster, units, roles, certifications, and account status.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-gray-950 border border-gray-900 rounded-2xl p-5">
            <h3 className="text-lg font-semibold mb-2">Units</h3>
            <p className="text-gray-400">
              Wilderness SAR, MRU, Water Unit, and Support Unit will be managed here.
            </p>
          </div>

          <div className="bg-gray-950 border border-gray-900 rounded-2xl p-5">
            <h3 className="text-lg font-semibold mb-2">Roles</h3>
            <p className="text-gray-400">
              Member, SAR Manager, and Global Admin roles will be managed here.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}