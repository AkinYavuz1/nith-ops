import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#D4A84B",
};

export const metadata: Metadata = {
  title: { default: "Nith Ops", template: "%s — Nith Ops" },
  description: "Private operations dashboard for Nith Digital",
  manifest: "/manifest.json",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0F1117] text-[#E4E7EC]`}>
        {children}
      </body>
    </html>
  );
}
