import type { Metadata } from "next";
import "./globals.css";
import AppBottomNav from "@/components/AppBottomNav";
import AuthGate from "@/components/AuthGate";
import PushPermission from "@/components/PushPermission";
import NotificationListener from "@/components/NotificationListener";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Matzil SAR",
  description: "Matzil SAR Operations Platform",
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
            <div className="min-h-screen w-full overflow-x-hidden pb-20">
              {children}
            </div>
            <AppBottomNav />
          </ToastProvider>
        </AuthGate>
      </body>
    </html>
  );
}