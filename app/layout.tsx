import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Migrate | Immigration professionals, made clearer",
  description: "Find verified immigration lawyers and accredited advisers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
