"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function ChatIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H8l-4 4V6c0-1.1.9-2 2-2zm2 6a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

function ToolsIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const isTools = pathname.startsWith("/tools");

  if (pathname === "/login") return null;

  return (
    <nav className="flex border-t border-stone-200 dark:border-stone-800 bg-stone-50/95 dark:bg-[#111110]/95 backdrop-blur-md">
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
          !isTools
            ? "text-amber-500 dark:text-amber-400"
            : "text-stone-400 dark:text-stone-500"
        }`}
      >
        <ChatIcon filled={!isTools} />
        <span>对话</span>
      </Link>
      <Link
        href="/tools"
        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
          isTools
            ? "text-amber-500 dark:text-amber-400"
            : "text-stone-400 dark:text-stone-500"
        }`}
      >
        <ToolsIcon filled={isTools} />
        <span>工具箱</span>
      </Link>
    </nav>
  );
}
