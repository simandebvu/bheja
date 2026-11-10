import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bheja: AI treasurer for savings clubs",
  description: "An AI treasurer for stokvels and mukando groups, built on PayPal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
