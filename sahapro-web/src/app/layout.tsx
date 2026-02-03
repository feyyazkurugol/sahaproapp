import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { LangProvider } from "@/lib/i18n/LangProvider"; // 👈 BURASI

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SahaPro",
  description: "Field Service Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LangProvider defaultLang="tr">
          <AppShell>{children}</AppShell>
        </LangProvider>
      </body>
    </html>
  );
}
