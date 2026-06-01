import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "./components/BottomNav";
import { LanguageProvider } from "./components/LanguageProvider";
import LanguageToggle from "./components/LanguageToggle";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import CloudSyncGate from "./components/CloudSyncGate";

export const metadata: Metadata = {
  title: "掌柜 AI / Zhanggui AI",
  description: "AI business assistant for restaurant owners",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "掌柜 AI",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full" suppressHydrationWarning>
      <body className="h-full flex flex-col">
        <LanguageProvider>
          <main className="flex-1 overflow-hidden min-h-0">
            <CloudSyncGate>{children}</CloudSyncGate>
          </main>
          <LanguageToggle />
          <BottomNav />
        </LanguageProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
