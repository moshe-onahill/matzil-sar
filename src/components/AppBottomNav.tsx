"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredRole } from "@/lib/dev-user";

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconIncidents() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconUnits() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconRoster() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

const mainItems = [
  { href: "/", label: "Dashboard", Icon: IconDashboard },
  { href: "/incidents", label: "Active Calls", Icon: IconIncidents },
  { href: "/responders", label: "Units", Icon: IconUnits },
  { href: "/map", label: "Map", Icon: IconMap },
];

const moreItems = [
  { href: "/notifications", label: "Alerts", Icon: IconBell },
  { href: "/events", label: "Calendar", Icon: IconCalendar },
  { href: "/roster", label: "Roster", Icon: IconRoster },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export default function AppBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function checkRole() {
      const role = getStoredRole();
      setIsAdmin(role === "SAR Manager" || role === "Global Admin");
    }
    checkRole();
    window.addEventListener("storage", checkRole);
    setCollapsed(localStorage.getItem("nav-collapsed") === "1");
    return () => window.removeEventListener("storage", checkRole);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("nav-collapsed", next ? "1" : "0");
    window.dispatchEvent(new CustomEvent("nav-toggle", { detail: next ? "1" : "0" }));
  }

  if (pathname === "/login") return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/incidents") return pathname === "/incidents" || pathname.startsWith("/incidents/");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const moreActive = moreItems.some((item) => isActive(item.href));

  const allSidebarItems = [
    ...mainItems,
    ...moreItems,
    ...(isAdmin ? [{ href: "/admin", label: "Admin Console", Icon: IconAdmin }] : []),
  ];

  return (
    <>
      {/* ── SIDEBAR (desktop / landscape) ── */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-[100] flex-col border-r border-zinc-800/60 bg-zinc-950/95 backdrop-blur-xl transition-[width] duration-200 overflow-hidden ${collapsed ? "w-14" : "w-56"}`}>
        <div className={`flex items-center border-b border-zinc-800/60 ${collapsed ? "justify-center px-0 py-5" : "gap-2 px-5 py-5"}`}>
          {!collapsed && <span className="text-lg font-bold tracking-tight text-zinc-50">Matzil SAR</span>}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {allSidebarItems.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors ${collapsed ? "justify-center" : "gap-3"} ${
                  active ? "bg-red-600/15 text-red-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <Icon />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-800/60 px-2 py-3">
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center rounded-xl px-2.5 py-2 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              {collapsed
                ? <><path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/></>
                : <><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></>
              }
            </svg>
          </button>
        </div>
      </aside>

      {/* ── BOTTOM NAV (mobile / portrait) ── */}
      <>
        {moreOpen && (
          <div className="lg:hidden fixed inset-0 z-[105]" onClick={() => setMoreOpen(false)} />
        )}

        {moreOpen && (
          <div className="lg:hidden fixed bottom-[72px] right-3 z-[110] w-52 rounded-2xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-2xl shadow-black/60">
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive("/admin") ? "bg-red-600/15 text-red-400" : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <IconAdmin />
                <span>Admin Console</span>
              </Link>
            )}
            {moreItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive(href) ? "bg-red-600/15 text-red-400" : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}

        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-[100] border-t border-zinc-800/60 bg-zinc-950/95 backdrop-blur-xl supports-[padding:max(0px)]:pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className="mx-auto w-full max-w-5xl">
            <div className="grid grid-cols-5">
              {mainItems.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors"
                  >
                    <div className={`flex h-8 w-14 items-center justify-center rounded-full transition-all ${active ? "bg-red-600/15" : ""}`}>
                      <span className={`transition-colors ${active ? "text-red-400" : "text-zinc-500"}`}>
                        <Icon />
                      </span>
                    </div>
                    <span className={`text-[10px] font-medium transition-colors ${active ? "text-red-400" : "text-zinc-500"}`}>{label}</span>
                  </Link>
                );
              })}

              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors"
              >
                <div className={`flex h-8 w-14 items-center justify-center rounded-full transition-all ${moreActive || moreOpen ? "bg-red-600/15" : ""}`}>
                  <span className={`transition-colors ${moreActive || moreOpen ? "text-red-400" : "text-zinc-500"}`}>
                    <IconMore />
                  </span>
                </div>
                <span className={`text-[10px] font-medium transition-colors ${moreActive || moreOpen ? "text-red-400" : "text-zinc-500"}`}>More</span>
              </button>
            </div>
          </div>
        </nav>
      </>
    </>
  );
}
