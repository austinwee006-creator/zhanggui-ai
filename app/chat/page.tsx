"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { loadRestaurantProfile } from "../lib/restaurantProfile";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const ClipboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const MegaphoneIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const QUICK_ACTIONS = [
  {
    label: "产品建议",
    desc: "提升客单价与复购",
    promptZh: "帮我分析我的餐饮产品和套餐，给出提升客单价、复购率和外卖转化的具体建议。",
    promptEn: "Analyze my F&B products and bundles, then give practical ways to increase average order value, repeat purchases, and delivery conversion.",
    icon: <ClipboardIcon />,
  },
  {
    label: "营销文案",
    desc: "社媒推广与获客",
    promptZh: "帮我写一篇适合发布在社交媒体的餐饮推广文案，要吸引新客下单、预订或到店。",
    promptEn: "Write a social media promotion for my F&B business that can attract new customers to order, book, or visit.",
    icon: <MegaphoneIcon />,
  },
  {
    label: "客诉处理",
    desc: "有效回应与服务补救",
    promptZh: "客人投诉产品口味、出餐速度或外送体验，应该如何处理和回覆？",
    promptEn: "A customer complained about taste, serving speed, or delivery experience. How should I handle it and reply?",
    icon: <ChatIcon />,
  },
  {
    label: "成本分析",
    desc: "食材成本控制与优化",
    promptZh: "如何分析和控制餐饮生意的食材、包装、人工和平台抽佣成本？给出具体执行步骤。",
    promptEn: "How can I analyze and control food, packaging, labor, and delivery platform commission costs? Give concrete steps.",
    icon: <ChartIcon />,
  },
];

function AIAvatar({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <div className={`relative w-7 h-7 flex-shrink-0`}>
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
        <span className="text-white text-xs font-bold leading-none">A</span>
      </div>
      {pulsing && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
      )}
    </div>
  );
}

function formatMessage(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc pl-5 mb-3 space-y-1">
          {items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: boldify(item) }} />
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim().match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal pl-5 mb-3 space-y-1">
          {items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: boldify(item) }} />
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: boldify(line) }} />
    );
    i++;
  }

  return elements;
}

function boldify(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export default function ChatPage() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: trimmed },
      ];

      setMessages(newMessages);
      setInput("");
      setLoading(true);
      setStreamingText("");

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            profile: loadRestaurantProfile(),
            language,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Request failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamingText(accumulated);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated },
        ]);
        setStreamingText("");
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "发生错误，请重试。" },
          ]);
        }
        setStreamingText("");
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [language, messages, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0 && !streamingText;

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-[#111110]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200/70 dark:border-stone-800/70 bg-stone-50/90 dark:bg-[#111110]/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold leading-none">掌</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-tight">
              掌柜 AI
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <p className="text-xs text-stone-400">餐饮老板的 AI 助手</p>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setStreamingText(""); }}
            className="text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 px-3 py-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            清除
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center pb-8 px-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg mb-5">
              <span className="text-white text-2xl font-bold leading-none">掌</span>
            </div>
            <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-200 mb-1.5">
              你好，老板
            </h2>
            <p className="text-sm text-stone-400 dark:text-stone-500 mb-7">
              有什么餐饮问题可以帮你解决？
            </p>
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(language === "en" ? action.promptEn : action.promptZh)}
                  className="group flex flex-col items-start gap-2.5 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700/60 bg-white dark:bg-stone-900/50 hover:border-amber-300 dark:hover:border-amber-600/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all text-left"
                >
                  <span className="text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform">
                    {action.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-tight">
                      {action.label}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5 leading-snug">
                      {action.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start items-end"} msg-enter`}
          >
            {msg.role === "assistant" && <AIAvatar />}
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-br-md"
                  : "bg-white dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 rounded-bl-md shadow-sm border border-stone-100 dark:border-stone-700/50"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose-response">{formatMessage(msg.content)}</div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex gap-2.5 justify-start items-end msg-enter">
            <AIAvatar pulsing />
            <div className="max-w-[82%] rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-white dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 shadow-sm border border-stone-100 dark:border-stone-700/50">
              <div className="prose-response">
                {formatMessage(streamingText)}
                <span className="cursor-blink" />
              </div>
            </div>
          </div>
        )}

        {loading && !streamingText && (
          <div className="flex gap-2.5 justify-start items-end">
            <AIAvatar pulsing />
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white dark:bg-stone-800/80 shadow-sm border border-stone-100 dark:border-stone-700/50">
              <div className="flex space-x-1.5 items-center h-4">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-500 animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-500 animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-500 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick action chips when chat is active */}
      {!isEmpty && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(language === "en" ? action.promptEn : action.promptZh)}
              disabled={loading}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-stone-200 dark:border-stone-700/60 text-stone-500 dark:text-stone-400 bg-white dark:bg-stone-900/40 hover:border-amber-300 dark:hover:border-amber-600/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pt-2 pb-8">
        <div className="flex items-end gap-2 rounded-2xl border border-stone-200 dark:border-stone-700/60 bg-white dark:bg-stone-900/70 px-3 py-2 shadow-sm focus-within:border-amber-400/70 dark:focus-within:border-amber-500/50 focus-within:shadow-md transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="输入问题..."
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none py-1 max-h-40 disabled:opacity-50"
          />
          <button
            onClick={() => {
              if (loading) {
                abortRef.current?.abort();
              } else {
                sendMessage(input);
              }
            }}
            className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              loading
                ? "bg-stone-200 dark:bg-stone-700 text-stone-500"
                : input.trim()
                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm hover:shadow-md hover:opacity-90 active:scale-95"
                : "bg-stone-100 dark:bg-stone-800 text-stone-400"
            }`}
          >
            {loading ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="2" width="8" height="8" rx="1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13V3M3 8l5-5 5 5" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-center text-xs text-stone-300 dark:text-stone-700 mt-2">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>

    </div>
  );
}
