"use client";

import { useState, useRef, useCallback } from "react";

type Tool = "menu" | "whatsapp" | "video" | "adimage";

type MenuInputs = {
  dishName: string;
  ingredients: string;
  cookingMethod: string;
  style: string;
  language: string;
};

type WhatsAppInputs = {
  customerMessage: string;
  context: string;
  restaurantName: string;
  restaurantInfo: string;
  language: string;
};

type VideoInputs = {
  restaurantName: string;
  topic: string;
  platform: string;
  duration: string;
  style: string;
};

const TOOLS: { id: Tool; label: string }[] = [
  { id: "menu", label: "菜单文案" },
  { id: "whatsapp", label: "WhatsApp 回复" },
  { id: "video", label: "短视频脚本" },
  { id: "adimage", label: "广告图片" },
];

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === opt
              ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
              : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
      {children}
      {required && <span className="text-amber-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/50 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-400/70 dark:focus:border-amber-500/50 transition-colors disabled:opacity-50"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/50 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-400/70 dark:focus:border-amber-500/50 transition-colors resize-none disabled:opacity-50"
    />
  );
}

function formatOutput(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }

    if (line.trim().startsWith("**") && line.trim().endsWith("**")) {
      elements.push(
        <p key={i} className="font-semibold text-stone-800 dark:text-stone-200 mt-3 first:mt-0 mb-0.5">
          {line.trim().slice(2, -2)}
        </p>
      );
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
        <ul key={i} className="list-disc pl-4 space-y-0.5 my-1">
          {items.map((item, j) => (
            <li key={j} className="text-stone-700 dark:text-stone-300"
              dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}
            />
          ))}
        </ul>
      );
      continue;
    }

    elements.push(
      <p key={i} className="text-stone-700 dark:text-stone-300 mb-1 last:mb-0"
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}
      />
    );
    i++;
  }

  return elements;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-500">已复制</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>复制</span>
        </>
      )}
    </button>
  );
}

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<Tool>("menu");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const [menuInputs, setMenuInputs] = useState<MenuInputs>({
    dishName: "",
    ingredients: "",
    cookingMethod: "",
    style: "家常温馨",
    language: "繁体中文",
  });

  const [waInputs, setWaInputs] = useState<WhatsAppInputs>({
    customerMessage: "",
    context: "预订查询",
    restaurantName: "Dinner World",
    restaurantInfo: "",
    language: "繁体中文",
  });

  const [videoInputs, setVideoInputs] = useState<VideoInputs>({
    restaurantName: "Dinner World",
    topic: "",
    platform: "TikTok",
    duration: "30秒",
    style: "美食特写",
  });

  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [adImagePreview, setAdImagePreview] = useState<string>("");
  const [adImageStyle, setAdImageStyle] = useState("餐厅宣传");
  const [adImageBg, setAdImageBg] = useState("木纹桌面");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [adImageLoading, setAdImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setOutput("");
    setStreaming("");
  };

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);
    handleReset();
  };

  const canGenerate = useCallback(() => {
    if (activeTool === "menu") return menuInputs.dishName.trim().length > 0;
    if (activeTool === "whatsapp") return waInputs.customerMessage.trim().length > 0;
    if (activeTool === "video") return videoInputs.topic.trim().length > 0;
    if (activeTool === "adimage") return adImageFile !== null;
    return false;
  }, [activeTool, menuInputs, waInputs, videoInputs, adImageFile]);

  const handleFileChange = (file: File) => {
    setAdImageFile(file);
    setGeneratedImageUrl("");
    const reader = new FileReader();
    reader.onload = (e) => setAdImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const generateAdImage = async () => {
    if (!adImageFile || adImageLoading) return;
    setGeneratedImageUrl("");
    setAdImageLoading(true);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(adImageFile);
      });

      const res = await fetch("/api/image-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: adImageFile.type,
          style: adImageStyle,
          background: adImageBg,
        }),
      });

      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      } else {
        alert(data.error || "生成失败，请重试");
      }
    } catch {
      alert("生成失败，请重试");
    } finally {
      setAdImageLoading(false);
    }
  };

  const generate = async () => {
    if (activeTool === "adimage") { generateAdImage(); return; }
    if (!canGenerate() || loading) return;

    setOutput("");
    setStreaming("");
    setLoading(true);

    const inputs =
      activeTool === "menu"
        ? menuInputs
        : activeTool === "whatsapp"
        ? waInputs
        : videoInputs;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: activeTool, inputs }),
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
        setStreaming(accumulated);
      }

      setOutput(accumulated);
      setStreaming("");
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setOutput("生成失败，请重试。");
      }
      setStreaming("");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const displayText = streaming || output;

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-[#111110]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200/70 dark:border-stone-800/70 bg-stone-50/90 dark:bg-[#111110]/90 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-stone-900 dark:text-stone-100">工具箱</h1>
        <p className="text-xs text-stone-400 mt-0.5">AI 生成，即改即用</p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 px-4 bg-stone-50 dark:bg-[#111110]">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleToolChange(t.id)}
            className={`py-2.5 mr-5 text-xs font-medium border-b-2 transition-colors ${
              activeTool === t.id
                ? "border-amber-400 text-amber-500 dark:text-amber-400"
                : "border-transparent text-stone-400 dark:text-stone-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Menu Copywriting Form */}
        {activeTool === "menu" && (
          <div className="space-y-4">
            <div>
              <Label required>菜名</Label>
              <Input
                value={menuInputs.dishName}
                onChange={(v) => setMenuInputs((p) => ({ ...p, dishName: v }))}
                placeholder="如：梅菜扣肉"
                disabled={loading}
              />
            </div>
            <div>
              <Label>主要食材</Label>
              <Input
                value={menuInputs.ingredients}
                onChange={(v) => setMenuInputs((p) => ({ ...p, ingredients: v }))}
                placeholder="如：五花肉、梅干菜"
                disabled={loading}
              />
            </div>
            <div>
              <Label>烹饪方式</Label>
              <Input
                value={menuInputs.cookingMethod}
                onChange={(v) => setMenuInputs((p) => ({ ...p, cookingMethod: v }))}
                placeholder="如：红烧、清蒸、干炒"
                disabled={loading}
              />
            </div>
            <div>
              <Label>定位风格</Label>
              <PillGroup
                options={["高端精致", "家常温馨", "网红爆款"]}
                value={menuInputs.style}
                onChange={(v) => setMenuInputs((p) => ({ ...p, style: v }))}
              />
            </div>
            <div>
              <Label>语言</Label>
              <PillGroup
                options={["繁体中文", "English", "中英对照"]}
                value={menuInputs.language}
                onChange={(v) => setMenuInputs((p) => ({ ...p, language: v }))}
              />
            </div>
          </div>
        )}

        {/* WhatsApp Reply Form */}
        {activeTool === "whatsapp" && (
          <div className="space-y-4">
            <div>
              <Label required>顾客消息</Label>
              <Textarea
                value={waInputs.customerMessage}
                onChange={(v) => setWaInputs((p) => ({ ...p, customerMessage: v }))}
                placeholder="粘贴顾客发来的原文消息..."
                rows={3}
                disabled={loading}
              />
            </div>
            <div>
              <Label>情境</Label>
              <PillGroup
                options={["预订查询", "菜单查询", "投诉处理", "营业时间", "一般询问"]}
                value={waInputs.context}
                onChange={(v) => setWaInputs((p) => ({ ...p, context: v }))}
              />
            </div>
            <div>
              <Label>餐厅名称</Label>
              <Input
                value={waInputs.restaurantName}
                onChange={(v) => setWaInputs((p) => ({ ...p, restaurantName: v }))}
                placeholder="如：Dinner World"
                disabled={loading}
              />
            </div>
            <div>
              <Label>补充信息（可选）</Label>
              <Textarea
                value={waInputs.restaurantInfo}
                onChange={(v) => setWaInputs((p) => ({ ...p, restaurantInfo: v }))}
                placeholder="如：营业时间、地址、预订电话等"
                rows={2}
                disabled={loading}
              />
            </div>
            <div>
              <Label>语言</Label>
              <PillGroup
                options={["繁体中文", "English", "Bahasa Melayu"]}
                value={waInputs.language}
                onChange={(v) => setWaInputs((p) => ({ ...p, language: v }))}
              />
            </div>
          </div>
        )}

        {/* Video Script Form */}
        {activeTool === "video" && (
          <div className="space-y-4">
            <div>
              <Label required>视频主题</Label>
              <Input
                value={videoInputs.topic}
                onChange={(v) => setVideoInputs((p) => ({ ...p, topic: v }))}
                placeholder="如：招牌脆皮烧鸭、宴席开桌流程"
                disabled={loading}
              />
            </div>
            <div>
              <Label>餐厅 / 品牌名称</Label>
              <Input
                value={videoInputs.restaurantName}
                onChange={(v) => setVideoInputs((p) => ({ ...p, restaurantName: v }))}
                placeholder="如：Dinner World"
                disabled={loading}
              />
            </div>
            <div>
              <Label>平台</Label>
              <PillGroup
                options={["TikTok", "Instagram Reels", "YouTube Shorts"]}
                value={videoInputs.platform}
                onChange={(v) => setVideoInputs((p) => ({ ...p, platform: v }))}
              />
            </div>
            <div>
              <Label>时长</Label>
              <PillGroup
                options={["15秒", "30秒", "60秒"]}
                value={videoInputs.duration}
                onChange={(v) => setVideoInputs((p) => ({ ...p, duration: v }))}
              />
            </div>
            <div>
              <Label>风格</Label>
              <PillGroup
                options={["美食特写", "ASMR", "探店 vlog", "幕后揭秘"]}
                value={videoInputs.style}
                onChange={(v) => setVideoInputs((p) => ({ ...p, style: v }))}
              />
            </div>
          </div>
        )}

        {/* Ad Image Tool */}
        {activeTool === "adimage" && (
          <div className="space-y-4">
            <div>
              <Label required>上传菜肴照片</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full rounded-2xl border-2 border-dashed transition-colors flex flex-col items-center justify-center py-6 gap-2 ${
                  adImagePreview
                    ? "border-amber-300 dark:border-amber-600/50"
                    : "border-stone-200 dark:border-stone-700 hover:border-amber-300"
                }`}
              >
                {adImagePreview ? (
                  <img src={adImagePreview} alt="preview" className="max-h-48 rounded-xl object-cover" />
                ) : (
                  <>
                    <svg className="w-8 h-8 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-sm text-stone-400">点击上传照片</span>
                    <span className="text-xs text-stone-300">JPG / PNG / HEIC</span>
                  </>
                )}
              </button>
              {adImagePreview && (
                <button
                  onClick={() => { setAdImageFile(null); setAdImagePreview(""); setGeneratedImageUrl(""); }}
                  className="mt-1.5 text-xs text-stone-400 hover:text-stone-600"
                >
                  重新选择
                </button>
              )}
            </div>

            <div>
              <Label>广告风格</Label>
              <PillGroup
                options={["餐厅宣传", "社媒风格", "高端精品", "简洁清新"]}
                value={adImageStyle}
                onChange={setAdImageStyle}
              />
            </div>

            <div>
              <Label>背景</Label>
              <PillGroup
                options={["木纹桌面", "大理石", "深色背景", "白色背景"]}
                value={adImageBg}
                onChange={setAdImageBg}
              />
            </div>

            {generatedImageUrl && (
              <div className="rounded-2xl border border-stone-200 dark:border-stone-700/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 dark:border-stone-700/50">
                  <span className="text-xs font-medium text-stone-500 dark:text-stone-400">生成结果</span>
                  <a
                    href={generatedImageUrl}
                    download="ad-photo.png"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    下载
                  </a>
                </div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-stone-400 mb-1.5 text-center">原图</p>
                    <img src={adImagePreview} alt="original" className="w-full rounded-xl object-cover aspect-square" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 mb-1.5 text-center">广告图</p>
                    <img src={generatedImageUrl} alt="generated" className="w-full rounded-xl object-cover aspect-square" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Output Area */}
        {displayText && (
          <div className="rounded-2xl border border-stone-200 dark:border-stone-700/60 bg-white dark:bg-stone-800/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 dark:border-stone-700/50">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">生成结果</span>
              {output && <CopyButton text={output} />}
            </div>
            <div className="px-4 py-3 text-sm leading-relaxed">
              {formatOutput(displayText)}
              {streaming && (
                <span className="cursor-blink" />
              )}
            </div>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-2" />
      </div>

      {/* Generate Button */}
      <div className="px-4 pt-3 pb-6 border-t border-stone-100 dark:border-stone-800/60 bg-stone-50 dark:bg-[#111110]">
        <button
          onClick={loading ? () => abortRef.current?.abort() : generate}
          disabled={activeTool === "adimage" ? adImageLoading || !adImageFile : !loading && !canGenerate()}
          className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all ${
            (activeTool === "adimage" ? adImageLoading : loading)
              ? "bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
              : canGenerate()
              ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm hover:opacity-90 active:scale-[0.98]"
              : "bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600 cursor-not-allowed"
          }`}
        >
          {activeTool === "adimage"
            ? adImageLoading ? "生成中（约20秒）..." : "生成广告图片"
            : loading ? "停止生成" : "生成"}
        </button>
      </div>
    </div>
  );
}
