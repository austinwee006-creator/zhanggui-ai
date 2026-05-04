import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "./components/BottomNav";

export const metadata: Metadata = {
  title: "掌柜 AI",
  description: "餐厅老板的 AI 生意助手",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full">
      <body className="h-full flex flex-col">
        <main className="flex-1 overflow-hidden min-h-0">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
