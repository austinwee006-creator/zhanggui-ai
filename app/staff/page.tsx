"use client";

import { useMemo, useState } from "react";
import {
  formatMoney,
  hasStaffIssue,
  loadStaffShiftRecords,
  saveStaffShiftRecords,
  shiftHours,
  shiftLaborCost,
  staffRoleOptions,
  staffStatusOptions,
  type StaffShiftRecord,
} from "../lib/businessRecords";

const todayText = new Date().toISOString().slice(0, 10);
const filterOptions = ["全部", "今天", "异常", "前厅", "厨房", "兼职"];

export default function StaffPage() {
  const [records, setRecords] = useState<StaffShiftRecord[]>(() => loadStaffShiftRecords());
  const [staffName, setStaffName] = useState("");
  const [role, setRole] = useState("前厅");
  const [date, setDate] = useState(todayText);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [status, setStatus] = useState("已排班");
  const [hourlyRate, setHourlyRate] = useState("");
  const [task, setTask] = useState("");
  const [handover, setHandover] = useState("");
  const [issue, setIssue] = useState("");
  const [filter, setFilter] = useState("全部");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        if (record.date === todayText) {
          acc.today += 1;
          acc.todayCost += shiftLaborCost(record);
        }
        if (hasStaffIssue(record)) acc.issues += 1;
        acc.hours += shiftHours(record);
        return acc;
      },
      { today: 0, issues: 0, todayCost: 0, hours: 0 }
    );
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (filter === "今天") return record.date === todayText;
      if (filter === "异常") return hasStaffIssue(record);
      if (filter === "全部") return true;
      return record.role === filter;
    });
  }, [filter, records]);

  const todayRecords = useMemo(() => records.filter((record) => record.date === todayText), [records]);

  const handoverText = useMemo(() => {
    const lines = todayRecords.length > 0
      ? todayRecords.map((record) => `- ${record.staffName}（${record.role} ${record.startTime}-${record.endTime}）：${record.task || "未填任务"}${record.handover ? `；交接：${record.handover}` : ""}${record.issue ? `；问题：${record.issue}` : ""}`)
      : ["- 今天还没有排班记录"];

    return `今日员工交接\n日期：${todayText}\n\n${lines.join("\n")}\n\n老板重点：${stats.issues > 0 ? `有 ${stats.issues} 个员工异常，要先处理排班和交接。` : "暂无员工异常，按计划执行开店、出餐、收银和关店任务。"}`;
  }, [stats.issues, todayRecords]);

  const advice = useMemo(() => {
    if (records.length === 0) return "先把今天排班录进去，系统才会提醒缺勤、迟到和交接事项。";
    if (stats.issues > 0) return `${stats.issues} 个员工异常，先确认谁补位、谁负责交接和关店。`;
    if (stats.today === 0) return "今天还没排班，先排前厅、厨房、收银和打包岗位。";
    return "今天人手已记录，重点检查高峰期岗位是否有人负责。";
  }, [records.length, stats.issues, stats.today]);

  const saveRecord = () => {
    const nextRecord: StaffShiftRecord = {
      id: String(Date.now()),
      staffName: staffName || "未填员工",
      role,
      date,
      startTime,
      endTime,
      status,
      hourlyRate: hourlyRate || "0",
      task,
      handover,
      issue,
      createdAt: new Date().toISOString(),
    };
    const nextRecords = [nextRecord, ...records].slice(0, 160);
    setRecords(nextRecords);
    saveStaffShiftRecords(nextRecords);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const updateRecord = (id: string, patch: Partial<StaffShiftRecord>) => {
    const nextRecords = records.map((record) => (record.id === id ? { ...record, ...patch } : record));
    setRecords(nextRecords);
    saveStaffShiftRecords(nextRecords);
  };

  const deleteRecord = (id: string) => {
    const nextRecords = records.filter((record) => record.id !== id);
    setRecords(nextRecords);
    saveStaffShiftRecords(nextRecords);
  };

  const copyHandover = async () => {
    await navigator.clipboard.writeText(handoverText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">员工排班</h1>
        <p className="mt-0.5 text-xs text-stone-400">管人手、岗位、工时、异常和交接</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="今日人手" value={String(stats.today)} />
          <MetricCard label="员工异常" value={String(stats.issues)} tone={stats.issues > 0 ? "red" : "stone"} />
          <MetricCard label="今日人工" value={formatMoney(stats.todayCost)} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 人手判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{advice}</h2>
          <button onClick={copyHandover} className="mt-4 rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-stone-950">
            {copied ? "已复制交接" : "复制今日交接"}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <Field label="员工姓名" value={staffName} onChange={setStaffName} placeholder="如：员工姓名、兼职、厨房负责人" />
          <Segment label="岗位" options={staffRoleOptions} value={role} onChange={setRole} />
          <Segment label="状态" options={staffStatusOptions} value={status} onChange={setStatus} tone="emerald" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="日期" value={date} onChange={setDate} type="date" />
            <Field label="时薪 RM" value={hourlyRate} onChange={setHourlyRate} inputMode="decimal" />
            <Field label="开始时间" value={startTime} onChange={setStartTime} type="time" />
            <Field label="结束时间" value={endTime} onChange={setEndTime} type="time" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">今日任务</label>
            <textarea value={task} onChange={(event) => setTask(event.target.value)} rows={2} placeholder="如：备料、收银、打包、洗碗、关店、盘点库存" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">交接事项</label>
            <textarea value={handover} onChange={(event) => setHandover(event.target.value)} rows={2} placeholder="如：某桌客诉、某食材快没、明早要补货、现金差额" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">异常/问题</label>
            <textarea value={issue} onChange={(event) => setIssue(event.target.value)} rows={2} placeholder="如：迟到、请假、缺人、服务投诉、出餐慢" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <button onClick={saveRecord} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {saved ? "已保存排班" : "保存排班记录"}
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">今日交接</h2>
            <p className="mt-1 text-xs text-stone-400">复制给店长、早晚班或群组使用。</p>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{handoverText}</pre>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">排班记录</h2>
            <span className="text-xs text-stone-400">总工时 {stats.hours.toFixed(1)} 小时</span>
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
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有对应排班</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">先把今天人手和岗位记录下来，系统才会提醒异常和交接。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((record) => (
                <StaffCard key={record.id} record={record} onUpdate={updateRecord} onDelete={deleteRecord} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, tone = "stone" }: { label: string; value: string; tone?: "stone" | "red" }) {
  const color = tone === "red" ? "text-red-500" : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; inputMode?: "text" | "tel" | "numeric" | "decimal" }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
    </div>
  );
}

function Segment({ label, options, value, onChange, tone = "amber" }: { label: string; options: string[]; value: string; onChange: (value: string) => void; tone?: "amber" | "emerald" }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${value === item ? tone === "emerald" ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"}`}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function StaffCard({ record, onUpdate, onDelete }: { record: StaffShiftRecord; onUpdate: (id: string, patch: Partial<StaffShiftRecord>) => void; onDelete: (id: string) => void }) {
  const issue = hasStaffIssue(record);

  return (
    <div className={`rounded-2xl border bg-white p-3 dark:bg-stone-900/60 ${issue ? "border-amber-300 dark:border-amber-900" : "border-stone-200/70 dark:border-stone-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.staffName} · {record.role}</p>
          <p className="mt-1 text-xs text-stone-400">{record.date} · {record.startTime}-{record.endTime} · {shiftHours(record).toFixed(1)} 小时</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] ${issue ? "bg-red-50 text-red-500 dark:bg-red-950/30" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300"}`}>
          {record.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="人工" value={formatMoney(shiftLaborCost(record))} />
        <MiniStat label="时薪" value={formatMoney(Number(record.hourlyRate) || 0)} />
      </div>
      {(record.task || record.handover || record.issue) && (
        <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
          {record.task ? `任务：${record.task}` : ""}{record.handover ? ` · 交接：${record.handover}` : ""}{record.issue ? ` · 问题：${record.issue}` : ""}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onUpdate(record.id, { status: "已到" })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">已到</button>
        <button onClick={() => onUpdate(record.id, { status: "已下班" })} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">已下班</button>
        <button onClick={() => onDelete(record.id)} className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-400">删除</button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-stone-900 dark:text-stone-100">{value}</p>
    </div>
  );
}
