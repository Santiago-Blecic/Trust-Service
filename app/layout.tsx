import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proofly — Trusted local services",
  description: "A marketplace where verified reviews are backed by completed services."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
