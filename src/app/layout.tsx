import type { Metadata } from "next";
import "./globals.css";
import AppBottomNav from "@/components/AppBottomNav";
import AuthGate from "@/components/AuthGate";
import PushPermission from "@/components/PushPermission";
import NotificationListener from "@/components/NotificationListener";
import { ToastProvider } from "@/components/Toast";
import SwipeNav from "@/components/SwipeNav";

export const metadata: Metadata = {
  title: { default: "Matzil SAR", template: "%s · Matzil SAR" },
  description: "Matzil Search & Rescue Operations Platform",
  applicationName: "Matzil SAR",
  themeColor: "#dc2626",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-50">
        <AuthGate>
          <ToastProvider>
            <PushPermission />
            <NotificationListener />
            <SwipeNav>
              <div className="min-h-screen w-full overflow-x-hidden pb-20">
                {children}
              </div>
            </SwipeNav>
            <AppBottomNav />
          </ToastProvider>
        </AuthGate>
      </body>
    </html>
  );
}