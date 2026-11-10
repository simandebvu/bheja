import type { Metadata, Viewport } from "next";
import { Martian_Mono, Onest, Unbounded } from "next/font/google";
import "./globals.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display", adjustFontFallback: false });
const body = Onest({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", adjustFontFallback: false });
const mono = Martian_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", adjustFontFallback: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
  title: "Rotapot · The AI treasurer for savings circles",
  description: "An AI treasurer for stokvels, mukando and diaspora savings circles. Collects with PayPal, reminds kindly in six languages, and pays out only when the treasurer says so.",
};

export const viewport: Viewport = { themeColor: "#24307A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
