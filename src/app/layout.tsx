import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/shared/Sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PayCore — Payments OS",
  description: "Production-grade payments platform covering the full lifecycle across six domains.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Sidebar />
        {/* 220px = sidebar width. Responsive: on small screens sidebar collapses but we keep simple for now */}
        <main style={{
          marginLeft: 220,
          minHeight: "100vh",
          padding: "36px 40px",
          maxWidth: "calc(100vw - 220px)",
          overflowX: "hidden",
        }}>
          {children}
        </main>
      </body>
    </html>
  );
}
