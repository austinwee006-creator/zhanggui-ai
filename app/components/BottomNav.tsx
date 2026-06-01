"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "今日", icon: HomeIcon },
  { href: "/orders", label: "订单", icon: OrderIcon },
  { href: "/customers", label: "客户", icon: CustomersIcon },
  { href: "/cashbook", label: "账目", icon: CashbookIcon },
  { href: "/tools", label: "内容", icon: SparkIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav
      className="grid grid-cols-5 border-t border-stone-200 dark:border-stone-800 bg-stone-50/95 dark:bg-[#111110]/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/" || pathname === "/chat"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
              active
                ? "text-amber-500 dark:text-amber-400"
                : "text-stone-400 dark:text-stone-500"
            }`}
          >
            <Icon filled={active} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5Z" />
    </svg>
  );
}

function OrderIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2V3Zm3 5h4m-4 4h6m-6 4h3" />
    </svg>
  );
}

function CustomersIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0ZM4 20c2.4-4 5.1-6 8-6s5.6 2 8 6M17.5 6.5c1.6.3 2.8 1.7 2.8 3.4 0 1.2-.6 2.3-1.5 2.9M6.5 6.5A3.5 3.5 0 0 0 5 12.8" />
    </svg>
  );
}

function SparkIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm6 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
    </svg>
  );
}

function CashbookIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14v16H5V4Zm4 4h6M9 12h2m3 0h1M9 16h2m3 0h1" />
    </svg>
  );
}
