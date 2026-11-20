import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store locator",
  description: "Find a Form stockist in the UK and Ireland.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
