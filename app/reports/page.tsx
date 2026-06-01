"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bookingBalance,
  hasBookingConflict,
  closingCashGap,
  closingExpenses,
  closingGrossSales,
  closingNetCash,
  customerValueScore,
  formatMoney,
  hasOperationTaskIssue,
  hasStaffIssue,
  inventoryValue,
  isBookingInFutureWindow,
  isBookingUnpaidDeposit,
  isCustomerFollowUpDue,
  isDormantCustomer,
  isExpiringSoon,
  isLowStock,
  isSupplierPurchaseDue,
  isSupplierPurchaseOverdue,
  loadBookingRecords,
  loadCustomerRecords,
  loadDailyClosingRecords,
  loadInventoryItems,
  loadOperationTaskRecords,
  loadOrderRecords,
  loadStaffShiftRecords,
  loadSupplierPurchaseRecords,
  orderBalance,
  operationCompletionRate,
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
} from "../lib/businessRecords";
import { useLanguage } from "../components/LanguageProvider";
import { defaultRestaurantProfile, fieldOr, loadRestaurantProfile, profileFallback } from "../lib/restaurantProfile";

const todayText = new Date().toISOString().slice(0, 10);
const periodOptions = ["今日", "本月", "全部"];

export default function ReportsPage() {
  const { language } = useLanguage();
  const [profile, setProfile] = useState(defaultRestaurantProfile);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [operations, setOperations] = useState<OperationTaskRecord[]>([]);
  const [staff, setStaff] = useState<StaffShiftRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchaseRecord[]>([]);
  const [period, setPeriod] = useState("今日");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadRestaurantProfile());
      setOrders(loadOrderRecords());
      setCustomers(loadCustomerRecords());
      setClosings(loadDailyClosingRecords());
      setInventory(loadInventoryItems());
      setOperations(loadOperationTaskRecords());
      setStaff(loadStaffShiftRecords());
      setBookings(loadBookingRecords());
      setSupplierPurchases(loadSupplierPurchaseRecords());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const report = useMemo(() => {
    const month = todayText.slice(0, 7);
    const inPeriod = (date: string) => {
      if (period === "今日") return date === todayText;
      if (period === "本月") return date.startsWith(month);
      return true;
    };

    const periodOrders = orders.filter((record) => inPeriod(record.date));
    const periodClosings = closings.filter((record) => inPeriod(record.date));
    const confirmedOrders = periodOrders.filter((record) => record.status === "已确认" || record.status === "已完成");
    const followUpOrders = orders.filter((record) => record.nextFollowUp && record.nextFollowUp <= todayText && record.status !== "已完成");
    const followUpCustomers = customers.filter((record) => isCustomerFollowUpDue(record));
    const dormantCustomers = customers.filter((record) => isDormantCustomer(record));
    const highValueCustomers = customers.filter((record) => record.stage === "VIP" || customerValueScore(record) >= 55);
    const incompleteCustomers = customers.filter((record) => !record.phone.trim() || !record.preference.trim());
    const lowStock = inventory.filter((item) => isLowStock(item));
    const expiringStock = inventory.filter((item) => isExpiringSoon(item));
    const periodOperations = operations.filter((record) => inPeriod(record.date));
    const openOperations = periodOperations.filter((record) => record.status !== "已完成");
    const operationIssues = periodOperations.filter((record) => hasOperationTaskIssue(record));
    const operationCompletion = operationCompletionRate(periodOperations);
    const periodStaff = staff.filter((record) => inPeriod(record.date));
    const staffIssues = staff.filter((record) => hasStaffIssue(record));
    const periodBookings = bookings.filter((record) => inPeriod(record.date));
    const futureBookings = bookings.filter((record) => isBookingInFutureWindow(record));
    const bookingConflicts = bookings.filter((record) => hasBookingConflict(record, bookings));
    const bookingUnpaidDeposits = bookings.filter((record) => isBookingUnpaidDeposit(record));
    const bookingDepositRisk = bookingUnpaidDeposits.reduce((sum, record) => sum + bookingBalance(record), 0);
    const supplierOutstanding = supplierOutstandingTotal(supplierPurchases);
    const supplierDueSoon = supplierPurchases.filter((record) => isSupplierPurchaseDue(record) && !isSupplierPurchaseOverdue(record));
    const supplierOverdue = supplierPurchases.filter((record) => isSupplierPurchaseOverdue(record));
    const laborCost = periodStaff.reduce((sum, record) => sum + shiftLaborCost(record), 0);
    const salesByClosing = periodClosings.reduce((sum, record) => sum + closingGrossSales(record), 0);
    const expenses = periodClosings.reduce((sum, record) => sum + closingExpenses(record), 0);
    const netCash = periodClosings.reduce((sum, record) => sum + closingNetCash(record), 0);
    const unpaid = orders.reduce((sum, record) => sum + (record.status === "已取消" ? 0 : orderBalance(record)), 0);
    const orderAmount = periodOrders.reduce((sum, record) => sum + toNumber(record.amount), 0);
    const confirmedAmount = confirmedOrders.reduce((sum, record) => sum + toNumber(record.amount), 0);
    const cashGap = periodClosings.reduce((sum, record) => sum + closingCashGap(record), 0);
    const customerSpend = customers.reduce((sum, record) => sum + toNumber(record.totalSpend), 0);
    const repeatCustomers = customers.filter((record) => record.stage === "老顾客" || record.stage === "VIP").length;
    const inventoryAmount = inventory.reduce((sum, item) => sum + inventoryValue(item), 0);
    const conversion = periodOrders.length > 0 ? (confirmedOrders.length / periodOrders.length) * 100 : 0;
    const repeatRate = customers.length > 0 ? (repeatCustomers / customers.length) * 100 : 0;

    return {
      periodOrders,
      periodClosings,
      confirmedOrders,
      followUpOrders,
      followUpCustomers,
      dormantCustomers,
      highValueCustomers,
      incompleteCustomers,
      lowStock,
      expiringStock,
      periodOperations,
      openOperations,
      operationIssues,
      operationCompletion,
      periodStaff,
      staffIssues,
      laborCost,
      salesByClosing,
      expenses,
      netCash,
      unpaid,
      orderAmount,
      confirmedAmount,
      cashGap,
      customerSpend,
      repeatCustomers,
      inventoryAmount,
      periodBookings,
      futureBookings,
      bookingConflicts,
      bookingUnpaidDeposits,
      bookingDepositRisk,
      supplierOutstanding,
      supplierDueSoon,
      supplierOverdue,
      conversion,
      repeatRate,
    };
  }, [bookings, closings, customers, inventory, operations, orders, period, staff, supplierPurchases]);

  const healthScore = useMemo(() => {
    let score = 72;
    if (report.netCash > 0) score += 8;
    if (report.unpaid > 0) score -= 8;
    if (report.followUpOrders.length + report.followUpCustomers.length > 0) score -= 8;
    if (report.dormantCustomers.length > 0) score -= 5;
    if (report.incompleteCustomers.length > 0) score -= 3;
    if (report.lowStock.length > 0) score -= 6;
    if (report.expiringStock.length > 0) score -= 8;
    if (report.staffIssues.length > 0) score -= 8;
    if (report.openOperations.length > 0) score -= 5;
    if (report.operationIssues.length > 0) score -= 8;
    if (report.bookingConflicts.length > 0) score -= 8;
    if (report.bookingUnpaidDeposits.length > 0) score -= 5;
    if (report.supplierDueSoon.length > 0) score -= 4;
    if (report.supplierOverdue.length > 0) score -= 9;
    if (report.highValueCustomers.length > 0) score += 4;
    if (report.conversion >= 60) score += 6;
    return Math.max(0, Math.min(100, score));
  }, [report]);

  const reportText = useMemo(() => {
    const brand = fieldOr(profile.name, profileFallback.name);
    const periodLabel = period === "今日" ? todayText : period;
    const risks = [
      report.unpaid > 0 ? `未收款 ${formatMoney(report.unpaid)}` : "",
      report.followUpOrders.length > 0 ? `${report.followUpOrders.length} 个订单待跟进` : "",
      report.followUpCustomers.length > 0 ? `${report.followUpCustomers.length} 个客户待回访` : "",
      report.dormantCustomers.length > 0 ? `${report.dormantCustomers.length} 个沉睡客户` : "",
      report.incompleteCustomers.length > 0 ? `${report.incompleteCustomers.length} 个客户资料不完整` : "",
      report.lowStock.length > 0 ? `${report.lowStock.length} 个低库存` : "",
      report.expiringStock.length > 0 ? `${report.expiringStock.length} 个快过期` : "",
      report.staffIssues.length > 0 ? `${report.staffIssues.length} 个员工异常` : "",
      report.openOperations.length > 0 ? `${report.openOperations.length} 个 SOP 未完成` : "",
      report.operationIssues.length > 0 ? `${report.operationIssues.length} 个营运异常` : "",
      report.bookingConflicts.length > 0 ? `${report.bookingConflicts.length} 个预订撞时段` : "",
      report.bookingUnpaidDeposits.length > 0 ? `${report.bookingUnpaidDeposits.length} 个预订未收订金` : "",
      report.supplierOverdue.length > 0 ? `${report.supplierOverdue.length} 笔供应商逾期` : "",
      report.supplierOutstanding > 0 ? `供应商应付款 ${formatMoney(report.supplierOutstanding)}` : "",
    ].filter(Boolean);

    if (language === "en") {
      const englishPeriodLabel = period === "今日" ? todayText : period === "本月" ? "This Month" : "All";
      const englishRisks = [
        report.unpaid > 0 ? `Uncollected ${formatMoney(report.unpaid)}` : "",
        report.followUpOrders.length > 0 ? `${report.followUpOrders.length} orders to follow up` : "",
        report.followUpCustomers.length > 0 ? `${report.followUpCustomers.length} customers to follow up` : "",
        report.dormantCustomers.length > 0 ? `${report.dormantCustomers.length} dormant customers` : "",
        report.incompleteCustomers.length > 0 ? `${report.incompleteCustomers.length} incomplete customer profiles` : "",
        report.lowStock.length > 0 ? `${report.lowStock.length} low-stock items` : "",
        report.expiringStock.length > 0 ? `${report.expiringStock.length} expiring items` : "",
        report.staffIssues.length > 0 ? `${report.staffIssues.length} staff issues` : "",
        report.openOperations.length > 0 ? `${report.openOperations.length} open SOP tasks` : "",
        report.operationIssues.length > 0 ? `${report.operationIssues.length} operations issues` : "",
        report.bookingConflicts.length > 0 ? `${report.bookingConflicts.length} booking time conflicts` : "",
        report.bookingUnpaidDeposits.length > 0 ? `${report.bookingUnpaidDeposits.length} bookings without deposits` : "",
        report.supplierOverdue.length > 0 ? `${report.supplierOverdue.length} supplier overdue payments` : "",
        report.supplierOutstanding > 0 ? `Supplier payables ${formatMoney(report.supplierOutstanding)}` : "",
      ].filter(Boolean);

      return `${brand} ${englishPeriodLabel} Business Report\n\nOrders: ${report.periodOrders.length} records, ${report.confirmedOrders.length} confirmed, conversion ${report.conversion.toFixed(0)}%.\nOrder amount: ${formatMoney(report.orderAmount)}, confirmed amount: ${formatMoney(report.confirmedAmount)}.\nBookings: ${report.periodBookings.length} this period, ${report.futureBookings.length} in the next 7 days, ${report.bookingConflicts.length} time conflicts, ${report.bookingUnpaidDeposits.length} without deposits (risk ${formatMoney(report.bookingDepositRisk)}).\nOperations SOP: ${report.periodOperations.length} tasks, completion ${report.operationCompletion}%, ${report.operationIssues.length} issues.\nClosing sales: ${formatMoney(report.salesByClosing)}, expenses: ${formatMoney(report.expenses)}, cash flow: ${formatMoney(report.netCash)}.\nSuppliers: payables ${formatMoney(report.supplierOutstanding)}, ${report.supplierDueSoon.length} due within 3 days, ${report.supplierOverdue.length} overdue.\nCustomers: ${customers.length}, repeat/VIP ${report.repeatCustomers}, high-value ${report.highValueCustomers.length}, dormant ${report.dormantCustomers.length}, customer value ${formatMoney(report.customerSpend)}, repeat share ${report.repeatRate.toFixed(0)}%.\nInventory: ${report.lowStock.length} low-stock items, ${report.expiringStock.length} expiring items, inventory value ${formatMoney(report.inventoryAmount)}.\nStaff: ${report.periodStaff.length} shifts, ${report.staffIssues.length} issues, labor ${formatMoney(report.laborCost)}.\n\nPriority: ${englishRisks.length > 0 ? englishRisks.join("; ") : "No obvious risk for now. Keep following high-margin products, repeat purchases, supplier terms and staff handover."}`;
    }

    return `${brand} ${periodLabel} 经营报告\n\n订单：${report.periodOrders.length} 条，已确认 ${report.confirmedOrders.length} 条，确认率 ${report.conversion.toFixed(0)}%。\n订单金额：${formatMoney(report.orderAmount)}，已确认金额：${formatMoney(report.confirmedAmount)}。\n预订：本期 ${report.periodBookings.length} 个，未来 7 天 ${report.futureBookings.length} 个，撞时段 ${report.bookingConflicts.length} 个，未收订金 ${report.bookingUnpaidDeposits.length} 个（风险 ${formatMoney(report.bookingDepositRisk)}）。\n营运 SOP：${report.periodOperations.length} 个任务，完成率 ${report.operationCompletion}%，异常 ${report.operationIssues.length} 个。\n结算营业额：${formatMoney(report.salesByClosing)}，支出：${formatMoney(report.expenses)}，现金流：${formatMoney(report.netCash)}。\n供应商：应付款 ${formatMoney(report.supplierOutstanding)}，3 天内到期 ${report.supplierDueSoon.length} 笔，逾期 ${report.supplierOverdue.length} 笔。\n客户：${customers.length} 个，老客/VIP ${report.repeatCustomers} 个，高价值 ${report.highValueCustomers.length} 个，沉睡 ${report.dormantCustomers.length} 个，客户价值 ${formatMoney(report.customerSpend)}，复购占比 ${report.repeatRate.toFixed(0)}%。\n库存：${report.lowStock.length} 个低库存，${report.expiringStock.length} 个快过期，库存金额 ${formatMoney(report.inventoryAmount)}。\n员工：${report.periodStaff.length} 条排班，异常 ${report.staffIssues.length} 个，人工 ${formatMoney(report.laborCost)}。\n\n优先处理：${risks.length > 0 ? risks.join("；") : "暂无明显风险，继续跟进高毛利产品、老顾客复购、供应商账期和员工交接。"}`;
  }, [customers.length, language, period, profile.name, report]);

  const actionPlan = useMemo(() => {
    const actions = [];
    if (language === "en") {
      if (report.followUpOrders.length > 0) actions.push(`Follow up ${report.followUpOrders.length} unfinished orders and confirm deposits, balances or delivery.`);
      if (report.unpaid > 0) actions.push(`Put uncollected ${formatMoney(report.unpaid)} as today's first priority.`);
      if (report.followUpCustomers.length > 0) actions.push(`Follow up ${report.followUpCustomers.length} due customers, prioritizing repeat and corporate customers.`);
      if (report.dormantCustomers.length > 0) actions.push(`Reactivate ${report.dormantCustomers.length} dormant customers with a new item, bundle or holiday offer.`);
      if (report.incompleteCustomers.length > 0) actions.push(`Complete phone or preference details for ${report.incompleteCustomers.length} customer profiles.`);
      if (report.highValueCustomers.length > 0) actions.push(`Send a reserved offer or thank-you message to ${report.highValueCustomers.length} high-value customers.`);
      if (report.bookingConflicts.length > 0) actions.push(`Confirm ${report.bookingConflicts.length} booking time conflicts first to avoid table, staffing or kitchen capacity problems.`);
      if (report.bookingUnpaidDeposits.length > 0) actions.push(`Collect deposits for ${report.bookingUnpaidDeposits.length} bookings. Deposit risk is ${formatMoney(report.bookingDepositRisk)}.`);
      if (report.supplierOverdue.length > 0) actions.push(`Handle ${report.supplierOverdue.length} supplier overdue payments and protect key ingredient and packaging supply first.`);
      if (report.supplierDueSoon.length > 0) actions.push(`Arrange ${report.supplierDueSoon.length} supplier payments due within 3 days.`);
      if (report.lowStock.length > 0) actions.push(`Restock ${report.lowStock.length} low-stock items before accepting orders you cannot fulfill.`);
      if (report.expiringStock.length > 0) actions.push(`Turn ${report.expiringStock.length} expiring items into today's featured item or staff meal.`);
      if (report.staffIssues.length > 0) actions.push(`Handle ${report.staffIssues.length} staff issues and confirm replacement or handover responsibility.`);
      if (report.operationIssues.length > 0) actions.push(`Handle ${report.operationIssues.length} operations SOP issues before the next peak or closing.`);
      if (report.openOperations.length > 0) actions.push(`Finish ${report.openOperations.length} open SOP tasks and leave a clear handover.`);
      if (actions.length === 0) actions.push("No obvious data risk today. Focus on content, lead building and selling high-margin products.");
      return actions;
    }

    if (report.followUpOrders.length > 0) actions.push(`先追 ${report.followUpOrders.length} 个未完成订单，确认订金、尾款或交付。`);
    if (report.unpaid > 0) actions.push(`把未收款 ${formatMoney(report.unpaid)} 排在今天第一优先。`);
    if (report.followUpCustomers.length > 0) actions.push(`回访 ${report.followUpCustomers.length} 个到期客户，优先老顾客和公司客户。`);
    if (report.dormantCustomers.length > 0) actions.push(`唤醒 ${report.dormantCustomers.length} 个沉睡客户，用新品、套餐或节日方案重新开口。`);
    if (report.incompleteCustomers.length > 0) actions.push(`补齐 ${report.incompleteCustomers.length} 个客户的电话或偏好，否则后面很难追单。`);
    if (report.highValueCustomers.length > 0) actions.push(`给 ${report.highValueCustomers.length} 个高价值客户发专属预留或感谢话术。`);
    if (report.bookingConflicts.length > 0) actions.push(`先确认 ${report.bookingConflicts.length} 个撞时段预订，避免同一时间桌位、人手或出餐能力不够。`);
    if (report.bookingUnpaidDeposits.length > 0) actions.push(`追 ${report.bookingUnpaidDeposits.length} 个预订订金，未收订金风险 ${formatMoney(report.bookingDepositRisk)}。`);
    if (report.supplierOverdue.length > 0) actions.push(`处理 ${report.supplierOverdue.length} 笔供应商逾期付款，先保住关键食材和包装供货。`);
    if (report.supplierDueSoon.length > 0) actions.push(`安排 ${report.supplierDueSoon.length} 笔 3 天内到期供应商付款。`);
    if (report.lowStock.length > 0) actions.push(`补 ${report.lowStock.length} 个低库存，避免接单后出不了货。`);
    if (report.expiringStock.length > 0) actions.push(`把 ${report.expiringStock.length} 个快过期库存做成今日主推或员工餐。`);
    if (report.staffIssues.length > 0) actions.push(`处理 ${report.staffIssues.length} 个员工异常，确认补位和交接责任。`);
    if (report.operationIssues.length > 0) actions.push(`处理 ${report.operationIssues.length} 个营运 SOP 异常，先解决影响高峰和关店的问题。`);
    if (report.openOperations.length > 0) actions.push(`完成 ${report.openOperations.length} 个未完成 SOP 任务，并留下交接。`);
    if (actions.length === 0) actions.push("今天数据暂无明显风险，集中做内容、开发客源和提高高毛利产品销量。");
    return actions;
  }, [language, report]);

  const copyReport = async () => {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">经营报告</h1>
        <p className="mt-0.5 text-xs text-stone-400">把订单、客户、账目、库存变成老板看得懂的日报</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="rounded-2xl border border-stone-200/70 bg-white p-2 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="grid grid-cols-3 gap-1">
            {periodOptions.map((item) => (
              <button key={item} onClick={() => setPeriod(item)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${period === item ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "text-stone-500 dark:text-stone-400"}`}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">生意健康分</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <p className="text-4xl font-semibold">{healthScore}</p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold dark:bg-stone-950/10">
              {healthScore >= 80 ? "健康" : healthScore >= 60 ? "要盯紧" : "高风险"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 opacity-80">{actionPlan[0]}</p>
        </section>

        <section className="grid grid-cols-2 gap-2.5">
          <MetricCard label="订单金额" value={formatMoney(report.orderAmount)} />
          <MetricCard label="已确认金额" value={formatMoney(report.confirmedAmount)} />
          <MetricCard label="结算营业额" value={formatMoney(report.salesByClosing)} />
          <MetricCard label="现金流" value={formatMoney(report.netCash)} danger={report.netCash < 0} />
          <MetricCard label="未收款" value={formatMoney(report.unpaid)} danger={report.unpaid > 0} />
          <MetricCard label="未来预订" value={`${report.futureBookings.length} 个`} danger={report.bookingConflicts.length > 0} />
          <MetricCard label="未收订金" value={formatMoney(report.bookingDepositRisk)} danger={report.bookingUnpaidDeposits.length > 0} />
          <MetricCard label="供应商应付" value={formatMoney(report.supplierOutstanding)} danger={report.supplierOutstanding > 0} />
          <MetricCard label="逾期付款" value={`${report.supplierOverdue.length} 笔`} danger={report.supplierOverdue.length > 0} />
          <MetricCard label="客户价值" value={formatMoney(report.customerSpend)} />
          <MetricCard label="客户待回访" value={`${report.followUpCustomers.length} 个`} danger={report.followUpCustomers.length > 0} />
          <MetricCard label="沉睡客户" value={`${report.dormantCustomers.length} 个`} danger={report.dormantCustomers.length > 0} />
          <MetricCard label="高价值客户" value={`${report.highValueCustomers.length} 个`} />
          <MetricCard label="SOP 完成率" value={`${report.operationCompletion}%`} danger={report.openOperations.length > 0} />
          <MetricCard label="营运异常" value={`${report.operationIssues.length} 个`} danger={report.operationIssues.length > 0} />
          <MetricCard label="库存金额" value={formatMoney(report.inventoryAmount)} />
          <MetricCard label="人工成本" value={formatMoney(report.laborCost)} />
          <MetricCard label="员工异常" value={`${report.staffIssues.length} 个`} danger={report.staffIssues.length > 0} />
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">关键比例</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="确认率" value={`${report.conversion.toFixed(0)}%`} />
            <MiniStat label="复购占比" value={`${report.repeatRate.toFixed(0)}%`} />
            <MiniStat label="现金差额" value={formatMoney(report.cashGap)} danger={Math.abs(report.cashGap) > 5} />
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">老板下一步</h2>
            <span className="text-xs text-stone-400">{actionPlan.length} 项</span>
          </div>
          <div className="mt-3 space-y-2">
            {actionPlan.map((item, index) => (
              <div key={item} className="flex gap-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {index + 1}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">可复制报告</h2>
            <button onClick={copyReport} className="text-xs font-medium text-amber-500">{copied ? "已复制" : "复制"}</button>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{reportText}</pre>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${danger ? "text-red-500" : "text-stone-900 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${danger ? "text-red-500" : "text-stone-900 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}
