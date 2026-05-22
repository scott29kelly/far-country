import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Far Country",
  description:
    "A biblically grounded world model of heaven, sourced from the ESV Bible and Janet Willis's writings on the New Jerusalem.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-(--color-border) bg-(--color-card)">
          <nav className="mx-auto flex max-w-3xl items-baseline justify-between px-6 py-4">
            <Link
              href="/"
              className="text-lg font-semibold text-(--color-fg) hover:text-(--color-accent)"
            >
              Far Country
            </Link>
            <ul className="flex gap-6 text-sm">
              <li>
                <Link
                  href="/entities"
                  className="text-(--color-fg-muted) hover:text-(--color-accent)"
                >
                  Entities
                </Link>
              </li>
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-3xl px-6 py-8 text-xs text-(--color-fg-muted)">
          <p>
            Every claim is sourced. Conservative-Protestant hermeneutic,
            literal-where-possible; symbolic readings flagged.
          </p>
        </footer>
      </body>
    </html>
  );
}
