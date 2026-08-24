import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadDesk",
  description: "Follow up with every lead, on the shop floor.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "LeadDesk" },
  // Declared explicitly: setting `icons` at all replaces the file-convention icon,
  // so the browser tab icon has to be named here alongside the iOS one.
  icons: { icon: "/icon.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#16181d",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Writing direction is a setting, not a build-time decision: the whole UI has to
  // lay out correctly in Hebrew. Every layout uses logical properties, so this flips
  // the app cleanly. Message bodies carry dir="auto" independently of this.
  const { uiDirection } = await getSettings();
  return (
    <html lang="en" dir={uiDirection === "rtl" ? "rtl" : "ltr"}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
