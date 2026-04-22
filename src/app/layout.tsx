import type { Metadata } from "next";
import "./globals.css";
import AppBottomNav from "@/components/AppBottomNav";

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
      <body className="bg-black text-white">
        <div className="min-h-screen pb-24">{children}</div>
        <AppBottomNav />
      </body>
    </html>
  );
}