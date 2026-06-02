"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  hasBookingConflict,
  closingCashGap,
  closingGrossSales,
  closingNetCash,
  customerValueScore,
  formatMoney,
  inventoryValue,
  isBookingInFutureWindow,
  isBookingUnpaidDeposit,
  isCustomerFollowUpDue,
  isDormantCustomer,
  isExpiringSoon,
  isLowStock,
  isSupplierPurchaseDue,
  isSupplierPurchaseOverdue,
  hasStaffIssue,
  hasOperationTaskIssue,
  loadBookingRecords,
  loadCustomerRecords,
  loadDailyClosingRecords,
  loadInventoryItems,
  loadOperationTaskRecords,
  loadOrderRecords,
  loadStaffShiftRecords,
  loadSupplierPurchaseRecords,
  loadSupplierRecords,
  operationCompletionRate,
  orderBalance,
  shiftLaborCost,
  supplierOutstandingTotal,
  toNumber,
  type BookingRecord,
  type CustomerRecord,
  type DailyClosingRecord,
  type InventoryItem,
  type OperationTaskRecord,
  type OrderRecord,
  type StaffShiftRecord,
  type SupplierPurchaseRecord,
  type SupplierRecord,
} from "./lib/businessRecords";
import { defaultRestaurantProfile, fieldOr, loadRestaurantProfile, profileFallback } from "./lib/restaurantProfile";

type Priority = "urgent" | "soon" | "normal";

const quickLinks = [
  { href: "/orders", title: "接单与收款", desc: "记录询问、订金、尾款、跟进状态" },
  { href: "/calendar", title: "预订日历", desc: "看未来档期、撞单、订金和负责人" },
  { href: "/customers", title: "客户跟进", desc: "老客回访、VIP、沉睡客唤醒" },
  { href: "/cashbook", title: "每日结算", desc: "记录营业额、支出、现金差额" },
  { href: "/pos", title: "POS 导入", desc: "导入 POS 日报，自动写入每日结算" },
  { href: "/inventory", title: "库存采购", desc: "管缺货、快过期、供应商和采购单" },
  { href: "/operations", title: "营运 SOP", desc: "开店、午市、晚市、关店检查清单" },
  { href: "/suppliers", title: "供应商账款", desc: "看欠款、到期付款、采购清单" },
  { href: "/staff", title: "员工排班", desc: "管人手、工时、异常和交接" },
  { href: "/reports", title: "经营报告", desc: "汇总订单、客户、账目、库存风险" },
  { href: "/tools", title: "内容助手", desc: "回复、产品文案、短视频、广告图片" },
  { href: "/leads", title: "开发新客", desc: "找附近客群、写邀约、排动作" },
  { href: "/menu", title: "利润计算", desc: "算毛利、建议售价、判断促销" },
  { href: "/chat", title: "问掌柜 AI", desc: "处理临时经营问题" },
];

const priorityStyle: Record<Priority, string> = {
  urgent: "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60",
  soon: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60",
  normal: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60",
};

export default function DashboardPage() {
  const [profile, setProfile] = useState(defaultRestaurantProfile);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [staff, setStaff] = useState<StaffShiftRecord[]>([]);
  const [operations, setOperations] = useState<OperationTaskRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchaseRecord[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadRestaurantProfile());
      setOrders(loadOrderRecords());
      setCustomers(loadCustomerRecords());
      setClosings(loadDailyClosingRecords());
      setInventory(loadInventoryItems());
      setStaff(loadStaffShiftRecords());
      setOperations(loadOperationTaskRecords());
      setBookings(loadBookingRecords());
      setSuppliers(loadSupplierRecords());
      setSupplierPurchases(loadSupplierPurchaseRecords());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dashboard = useMemo(() => {
    const todayOrders = orders.filter((record) => record.date === today);
    const dueOrders = orders.filter((record) => record.nextFollowUp && record.nextFollowUp <= today && record.status !== "已完成");
    const dueCustomers = customers.filter((record) => isCustomerFollowUpDue(record));
    const dormantCustomers = customers.filter((record) => isDormantCustomer(record));
    const highValueCustomers = customers.filter((record) => record.stage === "VIP" || customerValueScore(record) >= 55);
    const incompleteCustomers = customers.filter((record) => !record.phone.trim() || !record.preference.trim());
    const unpaid = orders.reduce((sum, record) => sum + (record.status === "已取消" ? 0 : orderBalance(record)), 0);
    const todayRevenue = todayOrders.reduce((sum, record) => sum + toNumber(record.amount), 0);
    const confirmedRevenue = orders.reduce((sum, record) => sum + (record.status === "已确认" || record.status === "已完成" ? toNumber(record.amount) : 0), 0);
    const todayClosing = closings.find((record) => record.date === today);
    const month = today.slice(0, 7);
    const monthNetCash = closings.filter((record) => record.date.startsWith(month)).reduce((sum, record) => sum + closingNetCash(record), 0);
    const cashGap = todayClosing ? closingCashGap(todayClosing) : 0;
    const closingSales = todayClosing ? closingGrossSales(todayClosing) : 0;
    const lowStock = inventory.filter((item) => isLowStock(item));
    const expiringStock = inventory.filter((item) => isExpiringSoon(item));
    const inventoryAmount = inventory.reduce((sum, item) => sum + inventoryValue(item), 0);
    const todayStaff = staff.filter((record) => record.date === today);
    const staffIssues = staff.filter((record) => hasStaffIssue(record));
    const todayLaborCost = todayStaff.reduce((sum, record) => sum + shiftLaborCost(record), 0);
    const todayOperations = operations.filter((record) => record.date === today);
    const openOperations = todayOperations.filter((record) => record.status !== "已完成");
    const operationIssues = todayOperations.filter((record) => hasOperationTaskIssue(record));
    const operationCompletion = operationCompletionRate(todayOperations);
    const futureBookings = bookings.filter((record) => isBookingInFutureWindow(record));
    const bookingConflicts = bookings.filter((record) => hasBookingConflict(record, bookings));
    const bookingUnpaidDeposits = bookings.filter((record) => isBookingUnpaidDeposit(record));
    const bookingMissingOwner = futureBookings.filter((record) => record.owner.trim() === "");
    const supplierOutstanding = supplierOutstandingTotal(supplierPurchases);
    const supplierDueSoon = supplierPurchases.filter((record) => isSupplierPurchaseDue(record) && !isSupplierPurchaseOverdue(record));
    const supplierOverdue = supplierPurchases.filter((record) => isSupplierPurchaseOverdue(record));

    return { todayOrders, dueOrders, dueCustomers, dormantCustomers, highValueCustomers, incompleteCustomers, unpaid, todayRevenue, confirmedRevenue, todayClosing, monthNetCash, cashGap, closingSales, lowStock, expiringStock, inventoryAmount, todayStaff, staffIssues, todayLaborCost, todayOperations, openOperations, operationIssues, operationCompletion, futureBookings, bookingConflicts, bookingUnpaidDeposits, bookingMissingOwner, supplierOutstanding, supplierDueSoon, supplierOverdue, supplierCount: suppliers.length };
  }, [bookings, closings, customers, inventory, operations, orders, staff, supplierPurchases, suppliers.length, today]);

  const tasks: { title: string; detail: string; priority: Priority; href: string }[] = [
    dashboard.dueOrders.length > 0
      ? { title: `跟进 ${dashboard.dueOrders.length} 个订单`, detail: "确认需求、订金、尾款或交付安排，避免漏单。", priority: "urgent", href: "/orders" }
      : { title: "新增今天的询问/订单", detail: "把 WhatsApp、电话和 Walk-in 询问都记下来。", priority: "soon", href: "/orders" },
    dashboard.dueCustomers.length > 0 || dashboard.dormantCustomers.length > 0
      ? { title: `经营 ${dashboard.dueCustomers.length + dashboard.dormantCustomers.length} 个客户`, detail: `${dashboard.dueCustomers.length} 个今天要回访，${dashboard.dormantCustomers.length} 个沉睡客要唤醒。`, priority: dashboard.dueCustomers.length > 0 ? "urgent" : "soon", href: "/customers" }
      : dashboard.incompleteCustomers.length > 0
        ? { title: "补齐客户资料", detail: `${dashboard.incompleteCustomers.length} 个客户缺电话或偏好，后面很难追复购。`, priority: "soon", href: "/customers" }
        : { title: "经营高价值客户", detail: `${dashboard.highValueCustomers.length} 个高价值客户，定期发专属预留和主推产品。`, priority: "normal", href: "/customers" },
    dashboard.todayClosing
      ? { title: Math.abs(dashboard.cashGap) > 5 ? "检查现金差额" : "查看今日结算", detail: dashboard.cashGap === 0 ? "今天已经结算，继续观察营业额和支出。" : `现金差额 ${formatMoney(dashboard.cashGap)}，关店前要对账。`, priority: Math.abs(dashboard.cashGap) > 5 ? "urgent" : "normal", href: "/cashbook" }
      : { title: "完成今日结算", detail: "关店前记录营业额、支出、平台抽佣和钱箱现金。", priority: "soon", href: "/cashbook" },
    dashboard.lowStock.length > 0 || dashboard.expiringStock.length > 0
      ? { title: "处理库存风险", detail: `${dashboard.lowStock.length} 个低库存，${dashboard.expiringStock.length} 个快过期。`, priority: dashboard.expiringStock.length > 0 ? "urgent" : "soon", href: "/inventory" }
      : { title: "检查库存采购", detail: "记录常用食材、包装和供应商，减少临时缺货。", priority: "normal", href: "/inventory" },
    dashboard.operationIssues.length > 0
      ? { title: "处理营运异常", detail: `${dashboard.operationIssues.length} 个 SOP 任务有问题，先处理影响开店、高峰或关店的事项。`, priority: "urgent", href: "/operations" }
      : dashboard.openOperations.length > 0
        ? { title: "完成今日 SOP", detail: `${dashboard.openOperations.length} 个营运任务未完成，完成率 ${dashboard.operationCompletion}%。`, priority: "soon", href: "/operations" }
        : dashboard.todayOperations.length > 0
          ? { title: "复查今日营运交接", detail: "今日 SOP 已完成，把交接留给晚班或明早开店。", priority: "normal", href: "/operations" }
          : { title: "生成今日营运 SOP", detail: "把开店、午市、晚市、关店检查事项交给员工照着做。", priority: "soon", href: "/operations" },
    dashboard.bookingConflicts.length > 0 || dashboard.bookingUnpaidDeposits.length > 0 || dashboard.bookingMissingOwner.length > 0
      ? { title: "处理预订风险", detail: `${dashboard.bookingConflicts.length} 个撞时段，${dashboard.bookingUnpaidDeposits.length} 个未收订金，${dashboard.bookingMissingOwner.length} 个缺负责人。`, priority: dashboard.bookingConflicts.length > 0 ? "urgent" : "soon", href: "/calendar" }
      : dashboard.futureBookings.length > 0
        ? { title: `确认 ${dashboard.futureBookings.length} 个未来预订`, detail: "检查日期、时间、订金、负责人和特别备注。", priority: "normal", href: "/calendar" }
        : { title: "建立预订日历", detail: "把未来堂食、团体、活动和外卖预订集中管理。", priority: "normal", href: "/calendar" },
    dashboard.supplierOverdue.length > 0 || dashboard.supplierDueSoon.length > 0
      ? { title: "处理供应商付款", detail: `${dashboard.supplierOverdue.length} 笔逾期，${dashboard.supplierDueSoon.length} 笔 3 天内到期。`, priority: dashboard.supplierOverdue.length > 0 ? "urgent" : "soon", href: "/suppliers" }
      : dashboard.supplierOutstanding > 0
        ? { title: "安排供应商待付款", detail: `目前待付款 ${formatMoney(dashboard.supplierOutstanding)}，按到期日排优先级。`, priority: "soon", href: "/suppliers" }
        : { title: "建立供应商账款", detail: "记录常用供应商、采购欠款和付款到期日。", priority: "normal", href: "/suppliers" },
    dashboard.staffIssues.length > 0
      ? { title: "处理员工异常", detail: `${dashboard.staffIssues.length} 个迟到、请假、缺勤或交接问题。`, priority: "urgent", href: "/staff" }
      : { title: "安排今日人手", detail: "记录前厅、厨房、收银、打包和关店负责人。", priority: dashboard.todayStaff.length > 0 ? "normal" : "soon", href: "/staff" },
    { title: "看经营报告", detail: "用日报看清订单、现金流、客户复购和库存风险。", priority: "normal", href: "/reports" },
    { title: "发布今日主推内容", detail: `用 ${fieldOr(profile.signature, profileFallback.signature)} 写一条可发社媒的内容。`, priority: "soon", href: "/tools" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">今日经营</h1>
            <p className="mt-0.5 text-xs text-stone-400">{fieldOr(profile.name, profileFallback.name)} · 订单、档期、客户、账款</p>
          </div>
          <Link href="/settings" className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 dark:border-stone-700 dark:text-stone-300">
            资料
          </Link>
        </div>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="今日订单" value={String(dashboard.todayOrders.length)} />
          <MetricCard label="待跟进" value={String(dashboard.dueOrders.length + dashboard.dueCustomers.length)} tone="amber" />
          <MetricCard label="未收款" value={formatMoney(dashboard.unpaid)} tone="red" />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 今日判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">
            {orders.length === 0 && customers.length === 0 && closings.length === 0 && inventory.length === 0 && staff.length === 0 && operations.length === 0 && bookings.length === 0 && supplierPurchases.length === 0
              ? "先把今天的询问、未来预订、结算、库存、人手和供应商账款录进去，系统才会开始提醒跟进、收款、档期、缺货、交接和付款。"
              : `今天先处理 ${dashboard.dueOrders.length + dashboard.dueCustomers.length} 个待跟进，${dashboard.dormantCustomers.length} 个沉睡客户，${dashboard.openOperations.length} 个 SOP 任务，未来 7 天 ${dashboard.futureBookings.length} 个预订，供应商待付款 ${formatMoney(dashboard.supplierOutstanding)}。`}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/orders" className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-stone-950">
              记订单
            </Link>
            <Link href="/customers" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              追客户
            </Link>
            <Link href="/cashbook" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              对账
            </Link>
            <Link href="/inventory" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              查库存
            </Link>
            <Link href="/operations" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              做 SOP
            </Link>
            <Link href="/calendar" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              看档期
            </Link>
            <Link href="/suppliers" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              供应商
            </Link>
            <Link href="/staff" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              排人手
            </Link>
            <Link href="/reports" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              看报告
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">经营雷达</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <RadarItem label="今日预计营业额" value={formatMoney(dashboard.todayRevenue)} />
            <RadarItem label="今日已结算" value={dashboard.todayClosing ? formatMoney(dashboard.closingSales) : "未结算"} />
            <RadarItem label="已确认总额" value={formatMoney(dashboard.confirmedRevenue)} />
            <RadarItem label="本月现金流" value={formatMoney(dashboard.monthNetCash)} danger={dashboard.monthNetCash < 0} />
            <RadarItem label="低库存/快过期" value={`${dashboard.lowStock.length}/${dashboard.expiringStock.length}`} danger={dashboard.lowStock.length + dashboard.expiringStock.length > 0} />
            <RadarItem label="库存金额" value={formatMoney(dashboard.inventoryAmount)} />
            <RadarItem label="今日人手/异常" value={`${dashboard.todayStaff.length}/${dashboard.staffIssues.length}`} danger={dashboard.staffIssues.length > 0} />
            <RadarItem label="今日人工" value={formatMoney(dashboard.todayLaborCost)} />
            <RadarItem label="营运 SOP" value={`${dashboard.operationCompletion}%`} danger={dashboard.openOperations.length > 0} />
            <RadarItem label="营运异常" value={`${dashboard.operationIssues.length} 个`} danger={dashboard.operationIssues.length > 0} />
            <RadarItem label="未来预订" value={`${dashboard.futureBookings.length} 个`} danger={dashboard.bookingConflicts.length > 0} />
            <RadarItem label="未收订金" value={`${dashboard.bookingUnpaidDeposits.length} 个`} danger={dashboard.bookingUnpaidDeposits.length > 0} />
            <RadarItem label="供应商待付" value={formatMoney(dashboard.supplierOutstanding)} danger={dashboard.supplierOutstanding > 0} />
            <RadarItem label="供应商逾期" value={`${dashboard.supplierOverdue.length} 笔`} danger={dashboard.supplierOverdue.length > 0} />
            <RadarItem label="客户待回访" value={`${dashboard.dueCustomers.length} 个`} danger={dashboard.dueCustomers.length > 0} />
            <RadarItem label="沉睡客户" value={`${dashboard.dormantCustomers.length} 个`} danger={dashboard.dormantCustomers.length > 0} />
            <RadarItem label="高价值客户" value={`${dashboard.highValueCustomers.length} 个`} />
            <RadarItem label="客户资料" value={`${customers.length} 个`} />
            <RadarItem label="订单记录" value={`${orders.length} 条`} />
          </div>
        </section>

        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-stone-900 dark:text-stone-100">老板待办</h2>
          <div className="space-y-2">
            {tasks.map((task) => (
              <Link
                key={task.title}
                href={task.href}
                onClick={() => setChecked((prev) => ({ ...prev, [task.title]: !prev[task.title] }))}
                className="block w-full rounded-2xl border border-stone-200/70 bg-white p-3 text-left dark:border-stone-800 dark:bg-stone-900/60"
              >
                <div className="flex gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-xs ${checked[task.title] ? "border-emerald-400 bg-emerald-400 text-white" : "border-stone-300 text-transparent dark:border-stone-600"}`}>
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-medium ${checked[task.title] ? "text-stone-400 line-through" : "text-stone-900 dark:text-stone-100"}`}>{task.title}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${priorityStyle[task.priority]}`}>
                        {task.priority === "urgent" ? "紧急" : task.priority === "soon" ? "今天" : "普通"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-stone-400">{task.detail}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">今天订单</h2>
            <Link href="/orders" className="text-xs font-medium text-amber-500">查看全部</Link>
          </div>
          {dashboard.todayOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-5 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">今天还没有记录订单</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">有询问就先记录，后面才能追订金、尾款和复购。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dashboard.todayOrders.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{item.time} · {item.customerName}</p>
                      <p className="mt-1 text-xs text-stone-400">{item.orderType} · {item.pax} 人/份 · {formatMoney(toNumber(item.amount))}</p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-500 dark:bg-stone-800 dark:text-stone-300">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2.5 pb-3">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-stone-200/70 bg-white p-3 transition-transform active:scale-[0.98] dark:border-stone-800 dark:bg-stone-900/60">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{item.title}</p>
              <p className="mt-1 text-xs leading-snug text-stone-400">{item.desc}</p>
            </Link>
          ))}
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

function RadarItem({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${danger ? "text-red-500" : "text-stone-900 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}
