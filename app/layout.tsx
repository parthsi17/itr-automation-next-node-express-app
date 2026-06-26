import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Income Tax Automation Dashboard",
  description: "Start runs and monitor automation events for income tax credential generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
