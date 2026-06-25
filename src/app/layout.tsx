import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import V1Gate from "@/components/V1Gate";
import { ToastProvider } from "@/components/Toast";
import ThemeApplier from "@/components/ThemeApplier";

export const metadata: Metadata = {
  title: { default: "Matzil SAR", template: "%s · Matzil SAR" },
  description: "Matzil Search & Rescue Operations Platform",
  applicationName: "Matzil SAR",
};

export const viewport: Viewport = {
  themeColor: "#E94E1B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-50">
        <ThemeApplier />
        <AuthGate>
          <ToastProvider>
            <V1Gate>{children}</V1Gate>
          </ToastProvider>
        </AuthGate>
      </body>
    </html>
  );
}
