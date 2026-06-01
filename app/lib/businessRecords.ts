import { pushDocument } from "./cloudSync";

export const orderRecordStorageKey = "zg_order_records_v2";
export const legacyOrderRecordStorageKey = "zg_order_records_v1";
export const customerRecordStorageKey = "zg_customer_records_v1";
export const dailyClosingStorageKey = "zg_daily_closing_records_v1";
export const inventoryStorageKey = "zg_inventory_items_v1";
export const staffShiftStorageKey = "zg_staff_shift_records_v1";
export const bookingRecordStorageKey = "zg_booking_records_v1";
export const supplierRecordStorageKey = "zg_supplier_records_v1";
export const supplierPurchaseRecordStorageKey = "zg_supplier_purchase_records_v1";
export const operationTaskStorageKey = "zg_operation_task_records_v1";

export const orderTypeOptions = ["堂食预订", "外卖/自取", "活动餐饮", "团体订单", "甜品/蛋糕预订", "一般询问"];
export const channelOptions = ["WhatsApp", "电话", "Instagram", "Facebook", "Walk-in", "外卖平台", "转介绍"];
export const orderStatusOptions = ["新询问", "待报价", "待订金", "已确认", "已完成", "需跟进", "已取消"];
export const customerStageOptions = ["潜在客户", "新客", "老顾客", "VIP", "沉睡客"];
export const inventoryCategoryOptions = ["食材", "饮料", "包装", "调味料", "清洁用品", "其他"];
export const staffRoleOptions = ["前厅", "厨房", "饮料/吧台", "收银", "外送/打包", "店长", "兼职"];
export const staffStatusOptions = ["已排班", "已到", "迟到", "请假", "缺勤", "已下班"];
export const bookingStatusOptions = ["新预订", "待订金", "已确认", "已完成", "已取消"];
export const supplierCategoryOptions = ["食材", "饮料", "包装", "设备", "清洁用品", "服务", "其他"];
export const supplierPurchaseStatusOptions = ["未付款", "部分付款", "已付款", "有争议"];
export const operationPhaseOptions = ["开店准备", "午市高峰", "晚市高峰", "关店收尾"];
export const operationTaskStatusOptions = ["待处理", "进行中", "已完成", "有问题"];

export type OrderRecord = {
  id: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  channel: string;
  date: string;
  time: string;
  pax: string;
  budget: string;
  amount: string;
  deposit: string;
  status: string;
  owner: string;
  nextFollowUp: string;
  notes: string;
  createdAt: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  stage: string;
  source: string;
  preference: string;
  lastOrder: string;
  totalSpend: string;
  visitCount: string;
  birthday: string;
  tags: string;
  nextFollowUp: string;
  lastContactedAt: string;
  orderIds: string[];
  notes: string;
  createdAt: string;
};

export type DailyClosingRecord = {
  id: string;
  date: string;
  cashSales: string;
  qrSales: string;
  cardSales: string;
  platformSales: string;
  otherSales: string;
  cashInDrawer: string;
  platformFees: string;
  foodPurchase: string;
  packagingCost: string;
  staffCost: string;
  rentUtility: string;
  otherExpense: string;
  wastage: string;
  notes: string;
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentQty: string;
  minQty: string;
  unitCost: string;
  supplier: string;
  expiryDate: string;
  lastPurchaseDate: string;
  notes: string;
  createdAt: string;
};

export type StaffShiftRecord = {
  id: string;
  staffName: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  hourlyRate: string;
  task: string;
  handover: string;
  issue: string;
  createdAt: string;
};

export type BookingRecord = {
  id: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  date: string;
  startTime: string;
  endTime: string;
  pax: string;
  amount: string;
  deposit: string;
  owner: string;
  status: string;
  notes: string;
  sourceOrderId: string;
  createdAt: string;
};

export type SupplierRecord = {
  id: string;
  name: string;
  category: string;
  phone: string;
  paymentTerms: string;
  notes: string;
  createdAt: string;
};

export type SupplierPurchaseRecord = {
  id: string;
  supplierId: string;
  supplierName: string;
  category: string;
  purchaseDate: string;
  dueDate: string;
  items: string;
  amount: string;
  paidAmount: string;
  status: string;
  notes: string;
  createdAt: string;
};

export type OperationTaskRecord = {
  id: string;
  date: string;
  phase: string;
  title: string;
  owner: string;
  status: string;
  notes: string;
  createdAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
  // 本地写入后，若已登入云端则后台同步（未配置/未登入时静默跳过）
  pushDocument(key, value);
}

function normalizeOrder(record: Partial<OrderRecord>): OrderRecord {
  return {
    id: record.id || String(Date.now()),
    customerName: record.customerName || "未填称呼",
    customerPhone: record.customerPhone || "",
    orderType: record.orderType || "一般询问",
    channel: record.channel || "WhatsApp",
    date: record.date || "未定日期",
    time: record.time || "未定时间",
    pax: record.pax || "0",
    budget: record.budget || "客户还未确认",
    amount: record.amount || "0",
    deposit: record.deposit || "0",
    status: record.status || "新询问",
    owner: record.owner || "",
    nextFollowUp: record.nextFollowUp || "",
    notes: record.notes || "",
    createdAt: record.createdAt || new Date().toISOString(),
  };
}

export function loadOrderRecords(): OrderRecord[] {
  const current = readJson<Partial<OrderRecord>[]>(orderRecordStorageKey, []);
  if (current.length > 0) return current.map(normalizeOrder);

  const legacy = readJson<Partial<OrderRecord>[]>(legacyOrderRecordStorageKey, []);
  return legacy.map(normalizeOrder);
}

export function saveOrderRecords(records: OrderRecord[]) {
  writeJson(orderRecordStorageKey, records);
}

export function loadCustomerRecords(): CustomerRecord[] {
  return readJson<Partial<CustomerRecord>[]>(customerRecordStorageKey, []).map((record) => ({
    id: record.id || String(Date.now()),
    name: record.name || "未填称呼",
    phone: record.phone || "",
    stage: record.stage || "潜在客户",
    source: record.source || "",
    preference: record.preference || "",
    lastOrder: record.lastOrder || "",
    totalSpend: record.totalSpend || "0",
    visitCount: record.visitCount || "0",
    birthday: record.birthday || "",
    tags: record.tags || "",
    nextFollowUp: record.nextFollowUp || "",
    lastContactedAt: record.lastContactedAt || "",
    orderIds: Array.isArray(record.orderIds) ? record.orderIds : [],
    notes: record.notes || "",
    createdAt: record.createdAt || new Date().toISOString(),
  }));
}

export function saveCustomerRecords(records: CustomerRecord[]) {
  writeJson(customerRecordStorageKey, records);
}

export function loadDailyClosingRecords(): DailyClosingRecord[] {
  return readJson<Partial<DailyClosingRecord>[]>(dailyClosingStorageKey, []).map((record) => ({
    id: record.id || String(Date.now()),
    date: record.date || new Date().toISOString().slice(0, 10),
    cashSales: record.cashSales || "0",
    qrSales: record.qrSales || "0",
    cardSales: record.cardSales || "0",
    platformSales: record.platformSales || "0",
    otherSales: record.otherSales || "0",
    cashInDrawer: record.cashInDrawer || "0",
    platformFees: record.platformFees || "0",
    foodPurchase: record.foodPurchase || "0",
    packagingCost: record.packagingCost || "0",
    staffCost: record.staffCost || "0",
    rentUtility: record.rentUtility || "0",
    otherExpense: record.otherExpense || "0",
    wastage: record.wastage || "0",
    notes: record.notes || "",
    createdAt: record.createdAt || new Date().toISOString(),
  }));
}

export function saveDailyClosingRecords(records: DailyClosingRecord[]) {
  writeJson(dailyClosingStorageKey, records);
}

export function loadInventoryItems(): InventoryItem[] {
  return readJson<Partial<InventoryItem>[]>(inventoryStorageKey, []).map((item) => ({
    id: item.id || String(Date.now()),
    name: item.name || "未命名物品",
    category: item.category || "食材",
    unit: item.unit || "kg",
    currentQty: item.currentQty || "0",
    minQty: item.minQty || "0",
    unitCost: item.unitCost || "0",
    supplier: item.supplier || "",
    expiryDate: item.expiryDate || "",
    lastPurchaseDate: item.lastPurchaseDate || "",
    notes: item.notes || "",
    createdAt: item.createdAt || new Date().toISOString(),
  }));
}

export function saveInventoryItems(items: InventoryItem[]) {
  writeJson(inventoryStorageKey, items);
}

export function loadStaffShiftRecords(): StaffShiftRecord[] {
  return readJson<Partial<StaffShiftRecord>[]>(staffShiftStorageKey, []).map((record) => ({
    id: record.id || String(Date.now()),
    staffName: record.staffName || "未填员工",
    role: record.role || "前厅",
    date: record.date || new Date().toISOString().slice(0, 10),
    startTime: record.startTime || "10:00",
    endTime: record.endTime || "18:00",
    status: record.status || "已排班",
    hourlyRate: record.hourlyRate || "0",
    task: record.task || "",
    handover: record.handover || "",
    issue: record.issue || "",
    createdAt: record.createdAt || new Date().toISOString(),
  }));
}

export function saveStaffShiftRecords(records: StaffShiftRecord[]) {
  writeJson(staffShiftStorageKey, records);
}

export function loadBookingRecords(): BookingRecord[] {
  return readJson<Partial<BookingRecord>[]>(bookingRecordStorageKey, []).map((record) => ({
    id: record.id || String(Date.now()),
    customerName: record.customerName || "未填称呼",
    customerPhone: record.customerPhone || "",
    orderType: record.orderType || "堂食预订",
    date: record.date || new Date().toISOString().slice(0, 10),
    startTime: record.startTime || "18:00",
    endTime: record.endTime || "20:00",
    pax: record.pax || "0",
    amount: record.amount || "0",
    deposit: record.deposit || "0",
    owner: record.owner || "",
    status: record.status || "新预订",
    notes: record.notes || "",
    sourceOrderId: record.sourceOrderId || "",
    createdAt: record.createdAt || new Date().toISOString(),
  }));
}

export function saveBookingRecords(records: BookingRecord[]) {
  writeJson(bookingRecordStorageKey, records);
}

export function loadSupplierRecords(): SupplierRecord[] {
  return readJson<Partial<SupplierRecord>[]>(supplierRecordStorageKey, []).map((record) => ({
    id: record.id || String(Date.now()),
    name: record.name || "未填供应商",
    category: record.category || "食材",
    phone: record.phone || "",
    paymentTerms: record.paymentTerms || "",
    notes: record.notes || "",
    createdAt: record.createdAt || new Date().toISOString(),
  }));
}

export function saveSupplierRecords(records: SupplierRecord[]) {
  writeJson(supplierRecordStorageKey, records);
}

export function loadSupplierPurchaseRecords(): SupplierPurchaseRecord[] {
  return readJson<Partial<SupplierPurchaseRecord>[]>(supplierPurchaseRecordStorageKey, []).map((record) => ({
    id: record.id || String(Date.now()),
    supplierId: record.supplierId || "",
    supplierName: record.supplierName || "未填供应商",
    category: record.category || "食材",
    purchaseDate: record.purchaseDate || new Date().toISOString().slice(0, 10),
    dueDate: record.dueDate || "",
    items: record.items || "",
    amount: record.amount || "0",
    paidAmount: record.paidAmount || "0",
    status: record.status || "未付款",
    notes: record.notes || "",
    createdAt: record.createdAt || new Date().toISOString(),
  }));
}

export function saveSupplierPurchaseRecords(records: SupplierPurchaseRecord[]) {
  writeJson(supplierPurchaseRecordStorageKey, records);
}

export function loadOperationTaskRecords(): OperationTaskRecord[] {
  return readJson<Partial<OperationTaskRecord>[]>(operationTaskStorageKey, []).map((record) => ({
    id: record.id || String(Date.now()),
    date: record.date || new Date().toISOString().slice(0, 10),
    phase: record.phase || "开店准备",
    title: record.title || "未命名任务",
    owner: record.owner || "",
    status: record.status || "待处理",
    notes: record.notes || "",
    createdAt: record.createdAt || new Date().toISOString(),
  }));
}

export function saveOperationTaskRecords(records: OperationTaskRecord[]) {
  writeJson(operationTaskStorageKey, records);
}

export function isOperationTaskDone(record: OperationTaskRecord) {
  return record.status === "已完成";
}

export function hasOperationTaskIssue(record: OperationTaskRecord) {
  return record.status === "有问题" || record.notes.trim().startsWith("!");
}

export function operationCompletionRate(records: OperationTaskRecord[]) {
  if (records.length === 0) return 0;
  const done = records.filter((record) => isOperationTaskDone(record)).length;
  return Math.round((done / records.length) * 100);
}

export function isCustomerFollowUpDue(record: CustomerRecord) {
  const days = daysUntil(record.nextFollowUp);
  return days !== null && days <= 0;
}

export function customerLastOrderDays(record: CustomerRecord) {
  if (!record.lastOrder) return null;
  const days = daysUntil(record.lastOrder);
  return days === null ? null : Math.abs(Math.min(days, 0));
}

export function isDormantCustomer(record: CustomerRecord, inactiveDays = 45) {
  if (record.stage === "沉睡客") return true;
  const lastOrderDays = customerLastOrderDays(record);
  return lastOrderDays !== null && lastOrderDays >= inactiveDays && record.stage !== "潜在客户";
}

export function customerAverageSpend(record: CustomerRecord) {
  const visits = Math.max(1, toNumber(record.visitCount));
  return toNumber(record.totalSpend) / visits;
}

export function customerValueScore(record: CustomerRecord) {
  const spendScore = Math.min(60, toNumber(record.totalSpend) / 20);
  const visitScore = Math.min(25, toNumber(record.visitCount) * 5);
  const stageScore = record.stage === "VIP" ? 25 : record.stage === "老顾客" ? 15 : record.stage === "新客" ? 5 : 0;
  const recencyDays = customerLastOrderDays(record);
  const recencyScore = recencyDays === null ? 0 : recencyDays <= 14 ? 15 : recencyDays <= 45 ? 8 : -10;
  return Math.max(0, Math.round(spendScore + visitScore + stageScore + recencyScore));
}

export function customerTier(record: CustomerRecord) {
  const score = customerValueScore(record);
  if (record.stage === "VIP" || score >= 75) return "重点客户";
  if (record.stage === "老顾客" || score >= 45) return "复购客户";
  if (isDormantCustomer(record)) return "唤醒客户";
  return "培养客户";
}

export function toNumber(value: string) {
  return Number(String(value).replace(/[^\d.]/g, "")) || 0;
}

export function formatMoney(value: number) {
  return `RM ${value.toFixed(2)}`;
}

export function orderBalance(record: OrderRecord) {
  return Math.max(0, toNumber(record.amount) - toNumber(record.deposit));
}

function normalizedPhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function isRealDate(dateText: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText);
}

function isRealTime(timeText: string) {
  return /^\d{2}:\d{2}$/.test(timeText);
}

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function laterDate(current: string, next: string) {
  if (!isRealDate(next)) return current;
  if (!isRealDate(current)) return next;
  return next > current ? next : current;
}

function addHoursToTime(timeText: string, hours = 2) {
  const minutes = timeTextToMinutes(timeText);
  if (minutes === null) return "20:00";
  const next = (minutes + hours * 60) % 1440;
  const hour = String(Math.floor(next / 60)).padStart(2, "0");
  const minute = String(next % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function orderCanCreateBooking(record: OrderRecord) {
  return record.status !== "已取消" && record.orderType !== "一般询问" && isRealDate(record.date) && isRealTime(record.time);
}

function bookingStatusFromOrder(record: OrderRecord) {
  if (record.status === "已取消") return "已取消";
  if (record.status === "已完成") return "已完成";
  if (record.status === "已确认") return "已确认";
  if (toNumber(record.amount) > 0 && toNumber(record.deposit) <= 0) return "待订金";
  return "新预订";
}

function customerStageFromOrder(record: OrderRecord, currentStage?: string) {
  if (currentStage === "VIP" || currentStage === "老顾客") return currentStage;
  if (toNumber(record.amount) >= 1000 || record.orderType === "活动餐饮" || record.orderType === "团体订单") return "VIP";
  if (record.status === "已确认" || record.status === "已完成") return currentStage === "新客" ? "老顾客" : "新客";
  return currentStage || "潜在客户";
}

function customerPreferenceFromOrder(record: OrderRecord, currentPreference: string) {
  if (currentPreference.trim()) return currentPreference;
  const note = record.notes.trim();
  return note ? `${record.orderType}：${note}` : record.orderType;
}

export function syncCustomerFromOrder(record: OrderRecord) {
  if (!record.customerName.trim() && !record.customerPhone.trim()) return "skipped";

  const customers = loadCustomerRecords();
  const phone = normalizedPhone(record.customerPhone);
  const index = customers.findIndex((customer) => {
    const samePhone = phone && normalizedPhone(customer.phone) === phone;
    const sameName = record.customerName.trim() && customer.name.trim().toLowerCase() === record.customerName.trim().toLowerCase();
    return samePhone || sameName;
  });
  const shouldCountOrder = record.status === "已确认" || record.status === "已完成";
  const orderAmount = toNumber(record.amount);
  const nextFollowUp = record.nextFollowUp || (record.status === "已完成" ? dateAfter(30) : dateAfter(7));

  if (index >= 0) {
    const current = customers[index];
    const alreadyCounted = current.orderIds.includes(record.id);
    const nextOrderIds = current.orderIds.includes(record.id) ? current.orderIds : [...current.orderIds, record.id];
    const nextCustomer: CustomerRecord = {
      ...current,
      name: current.name === "未填称呼" ? record.customerName || current.name : current.name,
      phone: current.phone || record.customerPhone,
      stage: customerStageFromOrder(record, current.stage),
      source: current.source || record.channel,
      preference: customerPreferenceFromOrder(record, current.preference),
      lastOrder: shouldCountOrder && isRealDate(record.date) ? laterDate(current.lastOrder, record.date) : current.lastOrder,
      totalSpend: shouldCountOrder && orderAmount > 0 && !alreadyCounted ? String(toNumber(current.totalSpend) + orderAmount) : current.totalSpend,
      visitCount: shouldCountOrder && !alreadyCounted ? String(toNumber(current.visitCount) + 1) : current.visitCount,
      nextFollowUp: current.nextFollowUp || nextFollowUp,
      notes: current.notes || record.notes,
      orderIds: nextOrderIds,
    };
    const nextCustomers = customers.map((customer, customerIndex) => (customerIndex === index ? nextCustomer : customer));
    saveCustomerRecords(nextCustomers);
    return "updated";
  }

  const nextCustomer: CustomerRecord = {
    id: String(Date.now()),
    name: record.customerName || "未填称呼",
    phone: record.customerPhone,
    stage: customerStageFromOrder(record),
    source: record.channel,
    preference: customerPreferenceFromOrder(record, ""),
    lastOrder: shouldCountOrder && isRealDate(record.date) ? record.date : "",
    totalSpend: shouldCountOrder ? record.amount || "0" : "0",
    visitCount: shouldCountOrder ? "1" : "0",
    birthday: "",
    tags: record.orderType === "团体订单" || record.orderType === "活动餐饮" ? "公司/活动客户" : "",
    nextFollowUp,
    lastContactedAt: "",
    orderIds: [record.id],
    notes: record.notes,
    createdAt: new Date().toISOString(),
  };
  saveCustomerRecords([nextCustomer, ...customers].slice(0, 160));
  return "created";
}

export function syncBookingFromOrder(record: OrderRecord) {
  const bookings = loadBookingRecords();
  const existingIndex = bookings.findIndex((booking) => booking.sourceOrderId === record.id);

  if (!orderCanCreateBooking(record)) {
    if (existingIndex >= 0 && record.status === "已取消") {
      const nextBookings = bookings.map((booking, index) => (index === existingIndex ? { ...booking, status: "已取消" } : booking));
      saveBookingRecords(nextBookings);
      return "updated";
    }
    return "skipped";
  }

  const nextBooking: BookingRecord = {
    id: existingIndex >= 0 ? bookings[existingIndex].id : String(Date.now() + 1),
    customerName: record.customerName || "未填称呼",
    customerPhone: record.customerPhone,
    orderType: record.orderType,
    date: record.date,
    startTime: record.time,
    endTime: addHoursToTime(record.time, 2),
    pax: record.pax || "0",
    amount: record.amount || "0",
    deposit: record.deposit || "0",
    owner: record.owner,
    status: bookingStatusFromOrder(record),
    notes: record.notes || `来自订单：${record.budget}`,
    sourceOrderId: record.id,
    createdAt: existingIndex >= 0 ? bookings[existingIndex].createdAt : new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    const nextBookings = bookings.map((booking, index) => (index === existingIndex ? nextBooking : booking));
    saveBookingRecords(nextBookings);
    return "updated";
  }

  saveBookingRecords([nextBooking, ...bookings].slice(0, 160));
  return "created";
}

export function syncOrderToBusinessRecords(record: OrderRecord) {
  return {
    customer: syncCustomerFromOrder(record),
    booking: syncBookingFromOrder(record),
  };
}

export function bookingBalance(record: BookingRecord) {
  return Math.max(0, toNumber(record.amount) - toNumber(record.deposit));
}

export function isActiveBooking(record: BookingRecord) {
  return record.status !== "已取消" && record.status !== "已完成";
}

export function isBookingInFutureWindow(record: BookingRecord, withinDays = 7) {
  const days = daysUntil(record.date);
  return days !== null && days >= 0 && days <= withinDays && isActiveBooking(record);
}

export function isBookingUnpaidDeposit(record: BookingRecord) {
  return toNumber(record.amount) > 0 && toNumber(record.deposit) <= 0 && isActiveBooking(record);
}

function timeTextToMinutes(timeText: string) {
  const [hour = "", minute = ""] = timeText.split(":");
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  if (Number.isNaN(hourNumber) || Number.isNaN(minuteNumber)) return null;
  return hourNumber * 60 + minuteNumber;
}

export function hasBookingConflict(record: BookingRecord, records: BookingRecord[]) {
  if (!isActiveBooking(record)) return false;

  const start = timeTextToMinutes(record.startTime);
  const end = timeTextToMinutes(record.endTime);
  if (start === null || end === null || end <= start) return false;

  return records.some((item) => {
    if (item.id === record.id || item.date !== record.date || !isActiveBooking(item)) return false;
    const itemStart = timeTextToMinutes(item.startTime);
    const itemEnd = timeTextToMinutes(item.endTime);
    if (itemStart === null || itemEnd === null || itemEnd <= itemStart) return false;
    return start < itemEnd && itemStart < end;
  });
}

export function supplierPurchaseBalance(record: SupplierPurchaseRecord) {
  return Math.max(0, toNumber(record.amount) - toNumber(record.paidAmount));
}

export function isSupplierPurchasePaid(record: SupplierPurchaseRecord) {
  return record.status === "已付款" || supplierPurchaseBalance(record) <= 0;
}

export function isSupplierPurchaseDue(record: SupplierPurchaseRecord, withinDays = 3) {
  const days = daysUntil(record.dueDate);
  return days !== null && days <= withinDays && !isSupplierPurchasePaid(record);
}

export function isSupplierPurchaseOverdue(record: SupplierPurchaseRecord) {
  const days = daysUntil(record.dueDate);
  return days !== null && days < 0 && !isSupplierPurchasePaid(record);
}

export function supplierOutstandingTotal(records: SupplierPurchaseRecord[], supplierId?: string) {
  return records.reduce((sum, record) => {
    if (supplierId && record.supplierId !== supplierId) return sum;
    return sum + supplierPurchaseBalance(record);
  }, 0);
}

export function closingGrossSales(record: DailyClosingRecord) {
  return toNumber(record.cashSales) + toNumber(record.qrSales) + toNumber(record.cardSales) + toNumber(record.platformSales) + toNumber(record.otherSales);
}

export function closingExpenses(record: DailyClosingRecord) {
  return toNumber(record.platformFees) + toNumber(record.foodPurchase) + toNumber(record.packagingCost) + toNumber(record.staffCost) + toNumber(record.rentUtility) + toNumber(record.otherExpense) + toNumber(record.wastage);
}

export function closingNetCash(record: DailyClosingRecord) {
  return closingGrossSales(record) - closingExpenses(record);
}

export function closingCashGap(record: DailyClosingRecord) {
  return toNumber(record.cashInDrawer) - toNumber(record.cashSales);
}

export function inventoryValue(item: InventoryItem) {
  return toNumber(item.currentQty) * toNumber(item.unitCost);
}

export function isLowStock(item: InventoryItem) {
  return toNumber(item.currentQty) <= toNumber(item.minQty);
}

export function daysUntil(dateText: string) {
  if (!dateText) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function isExpiringSoon(item: InventoryItem, withinDays = 3) {
  const days = daysUntil(item.expiryDate);
  return days !== null && days <= withinDays;
}

export function shiftHours(record: StaffShiftRecord) {
  const start = Number(record.startTime.split(":")[0] || 0) + Number(record.startTime.split(":")[1] || 0) / 60;
  const end = Number(record.endTime.split(":")[0] || 0) + Number(record.endTime.split(":")[1] || 0) / 60;
  return Math.max(0, end - start);
}

export function shiftLaborCost(record: StaffShiftRecord) {
  return shiftHours(record) * toNumber(record.hourlyRate);
}

export function hasStaffIssue(record: StaffShiftRecord) {
  return record.status === "迟到" || record.status === "请假" || record.status === "缺勤" || record.issue.trim() !== "";
}
