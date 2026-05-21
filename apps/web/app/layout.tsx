import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Far Country (Phase 1 placeholder)",
  description:
    "Placeholder page that loads the Phase 1 canonical.json and renders one entity. Replaced by the real browse UI in Phase 2.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
