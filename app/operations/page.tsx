"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  hasOperationTaskIssue,
  loadOperationTaskRecords,
  operationCompletionRate,
  operationPhaseOptions,
  operationTaskStatusOptions,
  saveOperationTaskRecords,
  type OperationTaskRecord,
} from "../lib/businessRecords";

const todayText = new Date().toISOString().slice(0, 10);
const filterOptions = ["全部", "今天", "未完成", "有问题", "开店准备", "午市高峰", "晚市高峰", "关店收尾"];

const templateTasks = [
  { phase: "开店准备", title: "检查现金找零、QR、刷卡机和收银纸", owner: "收银" },
  { phase: "开店准备", title: "检查招牌食材、包装、饮料和外卖袋是否足够", owner: "厨房" },
  { phase: "开店准备", title: "确认今日预订、外送、自取和大单时间", owner: "店长" },
  { phase: "午市高峰", title: "确认前厅、厨房、打包、收银岗位都有人负责", owner: "店长" },
  { phase: "午市高峰", title: "记录缺货、客诉、出餐慢和平台异常", owner: "前厅" },
  { phase: "晚市高峰", title: "复查晚市预订、订金、桌位和负责人", owner: "店长" },
  { phase: "晚市高峰", title: "补齐高峰前备料和打包耗材", owner: "厨房" },
  { phase: "关店收尾", title: "完成现金、平台、刷卡和支出结算", owner: "收银" },
  { phase: "关店收尾", title: "记录明日要补货、维修、员工交接和未完成订单", owner: "店长" },
];

export default function OperationsPage() {
  const { language } = useLanguage();
  const [records, setRecords] = useState<OperationTaskRecord[]>([]);
  const [date, setDate] = useState(todayText);
  const [phase, setPhase] = useState("开店准备");
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("待处理");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("今天");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecords(loadOperationTaskRecords());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const todayRecords = useMemo(() => records.filter((record) => record.date === todayText), [records]);
  const openTasks = todayRecords.filter((record) => record.status !== "已完成");
  const issueTasks = todayRecords.filter((record) => hasOperationTaskIssue(record));
  const completion = operationCompletionRate(todayRecords);

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (filter === "今天") return record.date === todayText;
        if (filter === "未完成") return record.status !== "已完成";
        if (filter === "有问题") return hasOperationTaskIssue(record);
        if (filter === "全部") return true;
        return record.phase === filter;
      })
      .slice()
      .sort((a, b) => `${b.date} ${a.phase}`.localeCompare(`${a.date} ${b.phase}`));
  }, [filter, records]);

  const advice = useMemo(() => {
    if (language === "en") {
      if (todayRecords.length === 0) return "Create today's SOP first so staff know what to check before peak hours and closing.";
      if (issueTasks.length > 0) return `${issueTasks.length} SOP tasks have issues. Handle supply, staffing or service blockers before the next peak.`;
      if (openTasks.length > 0) return `${openTasks.length} SOP tasks are still open. Finish the owner-critical items before closing.`;
      return "Today's SOP is complete. Keep the closing handover ready for tomorrow.";
    }

    if (todayRecords.length === 0) return "先生成今天 SOP，让员工知道高峰和关店前要检查什么。";
    if (issueTasks.length > 0) return `${issueTasks.length} 个营运任务有问题，先处理供货、人手或服务阻塞。`;
    if (openTasks.length > 0) return `${openTasks.length} 个营运任务还没完成，关店前先收尾老板关键事项。`;
    return "今天 SOP 已完成，把关店交接留好给明天。";
  }, [issueTasks.length, language, openTasks.length, todayRecords.length]);

  const handoverText = useMemo(() => {
    if (language === "en") {
      const lines = todayRecords.length > 0
        ? todayRecords.map((record) => `- [${record.status}] ${record.phase}: ${record.title} (${record.owner || "No owner"})${record.notes ? ` | Notes: ${record.notes}` : ""}`)
        : ["- No SOP tasks recorded today"];

      return `Daily Operations Handover\nDate: ${todayText}\nCompletion: ${completion}%\nOpen tasks: ${openTasks.length}\nIssues: ${issueTasks.length}\n\n${lines.join("\n")}\n\nOwner focus: ${issueTasks.length > 0 ? "Resolve issue tasks before the next peak or opening shift." : openTasks.length > 0 ? "Finish open tasks before closing." : "SOP complete. Keep tomorrow's prep ready."}`;
    }

    const lines = todayRecords.length > 0
      ? todayRecords.map((record) => `- 【${record.status}】${record.phase}：${record.title}（${record.owner || "未安排"}）${record.notes ? `；备注：${record.notes}` : ""}`)
      : ["- 今天还没有 SOP 任务"];

    return `每日营运交接\n日期：${todayText}\n完成率：${completion}%\n未完成：${openTasks.length}\n有问题：${issueTasks.length}\n\n${lines.join("\n")}\n\n老板重点：${issueTasks.length > 0 ? "先处理有问题任务，避免影响下一轮高峰或明早开店。" : openTasks.length > 0 ? "关店前把未完成任务收尾。" : "SOP 已完成，准备明天备料和开店。"}`;
  }, [completion, issueTasks.length, language, openTasks.length, todayRecords]);

  const persist = (nextRecords: OperationTaskRecord[]) => {
    setRecords(nextRecords);
    saveOperationTaskRecords(nextRecords);
  };

  const seedToday = () => {
    const existingKeys = new Set(todayRecords.map((record) => `${record.phase}-${record.title}`));
    const nextTemplates = templateTasks
      .filter((task) => !existingKeys.has(`${task.phase}-${task.title}`))
      .map((task, index) => ({
        id: `${Date.now()}-${index}`,
        date: todayText,
        phase: task.phase,
        title: task.title,
        owner: task.owner,
        status: "待处理",
        notes: "",
        createdAt: new Date().toISOString(),
      }));

    if (nextTemplates.length === 0) return;
    persist([...nextTemplates, ...records].slice(0, 240));
    setFilter("今天");
  };

  const saveRecord = () => {
    const nextRecord: OperationTaskRecord = {
      id: String(Date.now()),
      date,
      phase,
      title: title || "未命名任务",
      owner,
      status,
      notes,
      createdAt: new Date().toISOString(),
    };

    persist([nextRecord, ...records].slice(0, 240));
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const updateRecord = (id: string, patch: Partial<OperationTaskRecord>) => {
    persist(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  };

  const deleteRecord = (id: string) => {
    persist(records.filter((record) => record.id !== id));
  };

  const copyHandover = async () => {
    await navigator.clipboard.writeText(handoverText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">营运 SOP</h1>
        <p className="mt-0.5 text-xs text-stone-400">开店、午市、晚市、关店检查清单</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="今日任务" value={String(todayRecords.length)} />
          <MetricCard label="完成率" value={`${completion}%`} tone={completion < 70 ? "amber" : "stone"} />
          <MetricCard label="有问题" value={String(issueTasks.length)} tone={issueTasks.length > 0 ? "red" : "stone"} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 营运判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{advice}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={seedToday} className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-stone-950">
              生成今日 SOP
            </button>
            <button onClick={copyHandover} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              {copied ? "已复制交接" : "复制营运交接"}
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <Segment label="时段" options={operationPhaseOptions} value={phase} onChange={setPhase} />
          <Field label="任务" value={title} onChange={setTitle} placeholder="如：检查现金找零、确认预订、补打包盒、记录客诉" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="日期" value={date} onChange={setDate} type="date" />
            <Field label="负责人" value={owner} onChange={setOwner} placeholder="如：店长、厨房、前厅、收银" />
          </div>
          <Segment label="状态" options={operationTaskStatusOptions} value={status} onChange={setStatus} tone="emerald" />
          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">备注</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="如：缺货、员工请假、平台机器坏、客诉、明天要补货" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>
          <button onClick={saveRecord} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {saved ? "已保存任务" : "保存营运任务"}
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">今日营运交接</h2>
            <span className="text-xs text-stone-400">{completion}%</span>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{handoverText}</pre>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">SOP 任务记录</h2>
            <span className="text-xs text-stone-400">{filteredRecords.length} 项</span>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterOptions.map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400"}`}>
                {item}
              </button>
            ))}
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有 SOP 任务</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">先生成今日 SOP，或手动添加需要员工执行的检查事项。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((record) => (
                <TaskCard key={record.id} record={record} onUpdate={updateRecord} onDelete={deleteRecord} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, tone = "stone" }: { label: string; value: string; tone?: "stone" | "amber" | "red" }) {
  const color = tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Segment({ label, options, value, onChange, tone = "stone" }: { label: string; options: string[]; value: string; onChange: (value: string) => void; tone?: "stone" | "emerald" }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${value === option ? tone === "emerald" ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
    </div>
  );
}

function TaskCard({ record, onUpdate, onDelete }: { record: OperationTaskRecord; onUpdate: (id: string, patch: Partial<OperationTaskRecord>) => void; onDelete: (id: string) => void }) {
  const issue = hasOperationTaskIssue(record);
  const done = record.status === "已完成";

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.title}</p>
          <p className="mt-1 text-xs text-stone-400">{record.date} · {record.phase} · {record.owner || "未安排负责人"}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${issue ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300" : done ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300"}`}>
          {record.status}
        </span>
      </div>
      {record.notes && <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">备注：{record.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onUpdate(record.id, { status: "进行中" })} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">进行中</button>
        <button onClick={() => onUpdate(record.id, { status: "已完成" })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">已完成</button>
        <button onClick={() => onUpdate(record.id, { status: "有问题" })} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-300">有问题</button>
        <button onClick={() => onDelete(record.id)} className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-400">删除</button>
      </div>
    </div>
  );
}
