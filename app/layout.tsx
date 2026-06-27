import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITR Automation — Operations Dashboard",
  description: "Monitor and operate Income Tax credential generation runs in real time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff", color: "#0f172a" }}>
        <header style={{
          background: "#f97316",
          color: "#fff",
          padding: "0 2rem",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 700,
          fontSize: "1.1rem",
          letterSpacing: "-0.01em",
        }}>
          <span> ITR Automation</span>
        </header>
        {children}
      </body>
    </html>
  );
}
