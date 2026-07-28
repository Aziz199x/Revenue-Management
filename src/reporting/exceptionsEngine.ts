import { AppData } from "@/data/types";
import { formatMoney, getContractEndDate, getDaysUntilDate } from "@/data/helpers";
import { HealthScoreResult, ManagementAlert, ManagementException, ExecutiveAction, MonthlyReport, PropertyPerformance, TopStat } from "./types";
import { MonthlyComparisons } from "./propertyStatisticsService";

export const EXCEPTION_CATEGORY_META: Record<ManagementException["category"], { label: string; color: string; badge: string }> = {
  critical: { label: "حرج", color: "text-red-700", badge: "bg-red-100 text-red-700" },
  warning: { label: "تنبيه", color: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  info: { label: "معلومة", color: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  success: { label: "إنجاز", color: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
};

export const HEALTH_LABEL_META: Record<HealthScoreResult["label"], { text: string; color: string }> = {
  excellent: { text: "ممتاز", color: "text-emerald-600" },
  good: { text: "جيد", color: "text-blue-600" },
  average: { text: "متوسط", color: "text-amber-600" },
  needs_attention: { text: "يحتاج انتباه", color: "text-orange-600" },
  critical: { text: "حرج", color: "text-red-600" },
};

export function classifyPropertyPerformance(health: HealthScoreResult): PropertyPerformance {
  const map: Record<HealthScoreResult["label"], PropertyPerformance["label"]> = {
    excellent: "excellent", good: "good", average: "average", needs_attention: "needs_attention", critical: "critical",
  };
  return { label: map[health.label], labelText: HEALTH_LABEL_META[health.label].text };
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

/** Detects every exception category automatically from cached report data. No manual input, no re-scanning raw payments in the UI. */
export function detectExceptions(data: AppData, buildingId: string, report: MonthlyReport, previous: MonthlyComparisons["previousMonth"] | null): ManagementException[] {
  const exceptions: ManagementException[] = [];
  const unitIds = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.id));

  // Warning — duplicate payment records flagged by the payment-matching service
  for (const row of report.unitRows) {
    if (row.duplicatePaymentIds.length > 0) {
      exceptions.push({
        id: nextId("exc"),
        category: "warning",
        title: `دفعات مكررة - ${row.unitName}`,
        description: `يوجد ${row.duplicatePaymentIds.length} سجل دفع زائد عن جدول الأقساط المتوقع لهذه الوحدة هذا الشهر. راجع الدفعات وصحح السجلات المكررة.`,
        unitId: row.unitId,
        unitName: row.unitName,
        recommendation: {
          priority: "medium",
          reason: "سجلات دفع أكثر من الأقساط المتوقعة",
          action: "مراجعة سجل الدفعات وحذف أو تصحيح المكرر",
        },
      });
    }
  }

  // Critical — per-unit overdue rent
  for (const row of report.unitRows) {
    if (row.status === "occupied_unpaid" && row.delayDays > 0) {
      exceptions.push({
        id: nextId("exc"),
        category: "critical",
        title: `إيجار متأخر - ${row.unitName}`,
        description: `${row.tenantName || "المستأجر"} لم يسدد إيجار ${row.unitName} منذ ${row.delayDays} يوم (${formatMoney(row.outstandingAmount)}).`,
        unitId: row.unitId,
        unitName: row.unitName,
        amount: row.outstandingAmount,
        recommendation: {
          priority: row.delayDays > 30 ? "urgent" : "high",
          reason: `تأخر السداد ${row.delayDays} يوم`,
          action: `التواصل مع ${row.tenantName || "المستأجر"} لتحصيل الإيجار المتأخر`,
          deadline: "خلال 3 أيام",
        },
      });
    }
    if (row.officeFeeOutstanding > 0 && row.collectionMethod === "ejar_platform") {
      exceptions.push({
        id: nextId("exc"),
        category: "critical",
        title: `عمولة إيجار غير محصلة - ${row.unitName}`,
        description: `تم استلام الإيجار عبر منصة إيجار دون تحصيل عمولة المكتب (${formatMoney(row.officeFeeOutstanding)}).`,
        unitId: row.unitId,
        unitName: row.unitName,
        amount: row.officeFeeOutstanding,
        recommendation: {
          priority: "medium",
          reason: "عمولة المكتب مستحقة عن دفعة عبر منصة إيجار",
          action: "تحصيل العمولة من أقرب دفعة قادمة لنفس المستأجر",
          deadline: "الدفعة القادمة",
        },
      });
    }
  }

  if (report.outstanding > 20000) {
    exceptions.push({
      id: nextId("exc"), category: "critical", title: "إجمالي الإيجار المستحق مرتفع",
      description: `إجمالي الإيجار غير المحصل هذا الشهر ${formatMoney(report.outstanding)}، وهو أعلى من الحد الآمن (20,000 ر.س).`,
      amount: report.outstanding,
      recommendation: { priority: "urgent", reason: "تجاوز الإيجار المستحق الحد الآمن", action: "مراجعة جميع الدفعات المتأخرة والتواصل مع المستأجرين", deadline: "هذا الأسبوع" },
    });
  }

  if (report.officeFeesOutstanding > 0 && report.officeFeesDue > 0 && report.officeFeesOutstanding / report.officeFeesDue > 0.3) {
    exceptions.push({
      id: nextId("exc"), category: "critical", title: "عمولات مكتب متأخرة",
      description: `${formatMoney(report.officeFeesOutstanding)} من عمولات المكتب لم تُحصّل بعد هذا الشهر.`,
      amount: report.officeFeesOutstanding,
      recommendation: { priority: "high", reason: "نسبة كبيرة من عمولة المكتب غير محصلة", action: "متابعة تحصيل العمولات من الدفعات المستلمة", deadline: "خلال أسبوع" },
    });
  }

  if (report.latePaymentsCount >= 3) {
    exceptions.push({
      id: nextId("exc"), category: "critical", title: "دفعات متأخرة متعددة",
      description: `يوجد ${report.latePaymentsCount} دفعات متأخرة أو جزئية في هذا العقار هذا الشهر.`,
      recommendation: { priority: "high", reason: "عدد كبير من الدفعات المتأخرة في نفس الشهر", action: "إرسال تذكيرات جماعية ومتابعة كل حالة على حدة", deadline: "هذا الأسبوع" },
    });
  }

  const occupancyRate = report.totalUnits > 0 ? (report.occupiedUnits / report.totalUnits) * 100 : 100;
  if (occupancyRate < 80 && report.totalUnits > 0) {
    exceptions.push({
      id: nextId("exc"), category: "critical", title: "نسبة الإشغال أقل من المستهدف",
      description: `نسبة الإشغال الحالية ${Math.round(occupancyRate)}%، أقل من المستهدف (80%).`,
      recommendation: { priority: "high", reason: "شواغر أكثر من الطبيعي", action: "الإعلان عن الوحدات الشاغرة وتفعيل خصومات تسويقية", deadline: "خلال أسبوعين" },
    });
  }

  // Expired contracts (critical) and contracts expiring soon (warning)
  const buildingContracts = data.contracts.filter((c) => unitIds.has(c.unitId) && !c.deletedAt && !["cancelled", "terminated", "eviction_completed"].includes(c.status || ""));
  for (const contract of buildingContracts) {
    const end = getContractEndDate(contract);
    const days = end ? getDaysUntilDate(end) : null;
    if (days === null) continue;
    const unit = data.units.find((u) => u.id === contract.unitId);
    if (days < 0) {
      exceptions.push({
        id: nextId("exc"), category: "critical", title: `عقد منتهي - ${unit?.name || ""}`,
        description: `عقد ${contract.tenantName || "المستأجر"} في ${unit?.name || "الوحدة"} انتهى منذ ${Math.abs(days)} يوم ولم يُجدد.`,
        unitId: contract.unitId, unitName: unit?.name,
        recommendation: { priority: "urgent", reason: "العقد منتهي فعلياً", action: "تجديد العقد أو إخلاء الوحدة رسمياً عبر منصة إيجار", deadline: "فوراً" },
      });
    } else if (days <= 45) {
      exceptions.push({
        id: nextId("exc"), category: "warning", title: `عقد على وشك الانتهاء - ${unit?.name || ""}`,
        description: `عقد ${contract.tenantName || "المستأجر"} في ${unit?.name || "الوحدة"} سينتهي خلال ${days} يوم.`,
        unitId: contract.unitId, unitName: unit?.name,
        recommendation: { priority: days <= 15 ? "high" : "medium", reason: `العقد ينتهي خلال ${days} يوم`, action: "التواصل مع المستأجر لتأكيد التجديد أو الإخلاء", deadline: `خلال ${Math.max(1, days - 7)} يوم` },
      });
    }
  }

  // Warning — rent collected late this month
  for (const row of report.unitRows) {
    if (row.status === "occupied_paid_late") {
      exceptions.push({
        id: nextId("exc"), category: "warning", title: `سداد متأخر - ${row.unitName}`,
        description: `تم تحصيل إيجار ${row.unitName} متأخراً بفارق ${row.delayDays} يوم عن موعد الاستحقاق.`,
        unitId: row.unitId, unitName: row.unitName, amount: row.rentAmount,
      });
    }
  }

  if (previous && previous.collectionRate !== null && report.collectionRate < previous.collectionRate - 5) {
    exceptions.push({
      id: nextId("exc"), category: "warning", title: "انخفاض نسبة التحصيل",
      description: `نسبة التحصيل انخفضت من ${previous.collectionRate}% إلى ${report.collectionRate}% مقارنة بالشهر السابق.`,
      recommendation: { priority: "medium", reason: "تراجع أداء التحصيل عن الشهر السابق", action: "مراجعة أسباب التأخر ومتابعة الدفعات المستحقة", deadline: "هذا الأسبوع" },
    });
  }

  if (previous && previous.maintenanceCost !== null && previous.maintenanceCost > 0 && report.maintenanceCost > previous.maintenanceCost * 1.4) {
    exceptions.push({
      id: nextId("exc"), category: "warning", title: "ارتفاع مصاريف الصيانة",
      description: `مصاريف الصيانة ارتفعت ${Math.round(((report.maintenanceCost - previous.maintenanceCost) / previous.maintenanceCost) * 100)}% مقارنة بالشهر السابق.`,
      amount: report.maintenanceCost,
      recommendation: { priority: "medium", reason: "زيادة غير معتادة في تكاليف الصيانة", action: "مراجعة طلبات الصيانة والتأكد من عدم وجود أعطال متكررة", deadline: "خلال أسبوع" },
    });
  }

  // Information — new contracts, new tenants, ejar collections
  const newContractsThisMonth = buildingContracts.filter((c) => (c.startDate || "").slice(0, 7) === report.yearMonth);
  for (const contract of newContractsThisMonth) {
    const unit = data.units.find((u) => u.id === contract.unitId);
    const priorContractForUnit = data.contracts.some((c) => c.id !== contract.id && c.unitId === contract.unitId && !c.deletedAt && (getContractEndDate(c) || c.endDate || "") < contract.startDate);
    exceptions.push({
      id: nextId("exc"), category: "info",
      title: priorContractForUnit ? `تجديد عقد - ${unit?.name || ""}` : `عقد جديد - ${unit?.name || ""}`,
      description: priorContractForUnit
        ? `تم تجديد عقد ${unit?.name || "الوحدة"} مع ${contract.tenantName || "المستأجر"}.`
        : `بدأ عقد جديد في ${unit?.name || "الوحدة"} مع ${contract.tenantName || "مستأجر جديد"}.`,
      unitId: contract.unitId, unitName: unit?.name,
    });
  }

  if (report.collectedThroughEjar > 0) {
    exceptions.push({ id: nextId("exc"), category: "info", title: "تحصيل عبر منصة إيجار", description: `${formatMoney(report.collectedThroughEjar)} تم تحصيلها عبر منصة إيجار هذا الشهر.` });
  }

  const completedRepairs = data.repairs.filter((r) => r.status === "completed" && r.repairDate.startsWith(report.yearMonth) && (r.buildingId === buildingId || (r.unitId ? unitIds.has(r.unitId) : false)));
  if (completedRepairs.length > 0) {
    exceptions.push({ id: nextId("exc"), category: "info", title: "أعمال صيانة مكتملة", description: `تم إنجاز ${completedRepairs.length} طلب صيانة هذا الشهر.` });
  }

  // Success
  if (report.expectedRent > 0 && report.collectionRate === 100) {
    exceptions.push({ id: nextId("exc"), category: "success", title: "تحصيل كامل 100%", description: "تم تحصيل كامل الإيجار المستحق لهذا الشهر." });
  }
  if (report.totalUnits > 0 && report.vacantUnits === 0) {
    exceptions.push({ id: nextId("exc"), category: "success", title: "إشغال كامل للعقار", description: "جميع وحدات هذا العقار مؤجرة حالياً." });
  }
  if (report.officeFeesDue > 0 && report.officeFeesOutstanding === 0) {
    exceptions.push({ id: nextId("exc"), category: "success", title: "تحصيل كامل لعمولات المكتب", description: "تم تحصيل جميع عمولات المكتب المستحقة هذا الشهر." });
  }
  if (report.latePaymentsCount === 0 && report.totalUnits > 0) {
    exceptions.push({ id: nextId("exc"), category: "success", title: "لا توجد دفعات متأخرة", description: "لا توجد أي دفعات متأخرة في هذا العقار هذا الشهر." });
  }
  if (report.maintenanceCost === 0) {
    exceptions.push({ id: nextId("exc"), category: "success", title: "لا توجد مصاريف صيانة", description: "لم تُسجَّل أي مصاريف صيانة على هذا العقار هذا الشهر." });
  }

  const order: Record<ManagementException["category"], number> = { critical: 0, warning: 1, info: 2, success: 3 };
  return exceptions.sort((a, b) => order[a.category] - order[b.category]);
}

const PRIORITY_ORDER: Record<ExecutiveAction["priority"], number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/** Executive Actions — every exception carrying a recommendation becomes an actionable, prioritized card. */
export function buildExecutiveActions(exceptions: ManagementException[]): ExecutiveAction[] {
  return exceptions
    .filter((exc) => exc.recommendation)
    .map((exc): ExecutiveAction => ({
      id: exc.id,
      priority: exc.recommendation!.priority,
      title: exc.title,
      reason: exc.recommendation!.reason,
      action: exc.recommendation!.action,
      deadline: exc.recommendation!.deadline,
      responsible: exc.recommendation!.responsible,
      unitId: exc.unitId,
    }))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/** Management Alerts — critical/warning/info banner list surfaced at the top of the dashboard. */
export function buildManagementAlerts(exceptions: ManagementException[]): ManagementAlert[] {
  return exceptions
    .filter((exc) => exc.category !== "success")
    .map((exc) => ({ id: exc.id, level: exc.category, title: exc.title, description: exc.description }));
}

export function buildFinancialInsights(report: MonthlyReport, comparisons: MonthlyComparisons): string[] {
  const insights: string[] = [];
  const prev = comparisons.previousMonth;

  if (prev.collectionRate !== null) {
    const delta = report.collectionRate - prev.collectionRate;
    if (Math.abs(delta) >= 2) insights.push(`نسبة التحصيل ${delta > 0 ? "ارتفعت" : "انخفضت"} ${Math.abs(delta)}% مقارنة بالشهر السابق.`);
  }
  if (comparisons.sixMonthAverage.maintenanceCost !== null && comparisons.sixMonthAverage.maintenanceCost > 0) {
    const diffPct = Math.round(((report.maintenanceCost - comparisons.sixMonthAverage.maintenanceCost) / comparisons.sixMonthAverage.maintenanceCost) * 100);
    if (Math.abs(diffPct) >= 15) insights.push(`مصاريف الصيانة هذا الشهر ${diffPct > 0 ? "أعلى" : "أقل"} بنسبة ${Math.abs(diffPct)}% من متوسط آخر 6 أشهر.`);
  }
  if (prev.outstanding !== null) {
    const delta = report.outstanding - prev.outstanding;
    if (Math.abs(delta) >= 500) insights.push(`الإيجار المستحق ${delta > 0 ? "زاد" : "انخفض"} بمقدار ${formatMoney(Math.abs(delta))} مقارنة بالشهر السابق.`);
  }
  if (report.lateCollectionsAmount > 0) {
    insights.push(`تم تحصيل ${formatMoney(report.lateCollectionsAmount)} من مستحقات أشهر سابقة، مما حسّن التدفق النقدي لهذا الشهر.`);
  }
  if (report.officeFeesOutstanding > 0) {
    insights.push(`عمولات مكتب متبقية دون تحصيل بقيمة ${formatMoney(report.officeFeesOutstanding)}.`);
  }
  if (prev.occupancyRate !== null) {
    const occupancyRate = report.totalUnits > 0 ? Math.round((report.occupiedUnits / report.totalUnits) * 100) : 0;
    const delta = occupancyRate - prev.occupancyRate;
    if (Math.abs(delta) >= 5) insights.push(`نسبة الإشغال ${delta > 0 ? "تحسنت" : "تراجعت"} بمقدار ${Math.abs(delta)}% مقارنة بالشهر السابق.`);
  }
  return insights;
}

/** AI Summary — one natural-language Arabic paragraph placed at the top of the report. */
export function buildExecutiveSummary(report: MonthlyReport, health: HealthScoreResult, comparisons: MonthlyComparisons): string {
  const sentences: string[] = [];
  const occupancyRate = report.totalUnits > 0 ? Math.round((report.occupiedUnits / report.totalUnits) * 100) : 0;

  if (report.expectedRent > 0) {
    sentences.push(`حقق هذا العقار نسبة تحصيل ${report.collectionRate}% هذا الشهر${report.collectedForMonth ? ` بإجمالي ${formatMoney(report.collectedForMonth)}` : ""}.`);
  } else {
    sentences.push("لا توجد دفعات إيجار مستحقة على هذا العقار خلال هذا الشهر.");
  }

  if (report.latePaymentsCount === 0) {
    sentences.push("لا توجد أي دفعات متأخرة حالياً.");
  } else {
    const worst = [...report.latePayments].sort((a, b) => b.delayDays - a.delayDays)[0];
    sentences.push(`يوجد ${report.latePaymentsCount} دفعة متأخرة${worst ? `، أبرزها دفعة متأخرة منذ ${worst.delayDays} يوم` : ""}.`);
  }

  if (report.lateCollectionsCount > 0) {
    sentences.push(`تم تحصيل ${report.lateCollectionsCount} دفعة من أشهر سابقة خلال هذا الشهر بقيمة ${formatMoney(report.lateCollectionsAmount)}.`);
  }

  sentences.push(`نسبة الإشغال ${occupancyRate}%${report.vacantUnits > 0 ? ` (${report.vacantUnits} وحدة شاغرة)` : ""}.`);

  if (comparisons.sixMonthAverage.maintenanceCost !== null && comparisons.sixMonthAverage.maintenanceCost > 0) {
    sentences.push(report.maintenanceCost <= comparisons.sixMonthAverage.maintenanceCost
      ? "مصاريف الصيانة أقل من أو تساوي متوسط آخر 6 أشهر."
      : "مصاريف الصيانة أعلى من متوسط آخر 6 أشهر.");
  }

  if (report.expirationsWithin45Days > 0) {
    sentences.push(`سينتهي ${report.expirationsWithin45Days} عقد خلال 45 يوم.`);
  }

  if (report.officeFeesOutstanding > 0) {
    sentences.push(`عمولات المكتب المتبقية دون تحصيل: ${formatMoney(report.officeFeesOutstanding)}.`);
  }

  sentences.push(`الأداء العام للعقار: ${HEALTH_LABEL_META[health.label].text}.`);

  return sentences.join(" ");
}

export function buildTopStats(data: AppData, buildingId: string, report: MonthlyReport): TopStat[] {
  const stats: TopStat[] = [];
  const unitIds = new Set(data.units.filter((u) => u.buildingId === buildingId).map((u) => u.id));
  const paidOnTime = report.unitRows.filter((r) => r.status === "occupied_paid" || r.status === "occupied_ejar");
  const bestTenant = [...paidOnTime].sort((a, b) => b.collectedAmount - a.collectedAmount)[0];
  if (bestTenant) stats.push({ key: "bestTenant", label: "أفضل مستأجر", unitName: bestTenant.unitName, tenantName: bestTenant.tenantName, value: formatMoney(bestTenant.collectedAmount) });

  const mostDelayed = [...report.latePayments].sort((a, b) => b.delayDays - a.delayDays)[0];
  if (mostDelayed) stats.push({ key: "mostDelayed", label: "الأكثر تأخراً", unitName: mostDelayed.unitName, tenantName: mostDelayed.tenantName, value: `${mostDelayed.delayDays} يوم` });

  const largestRent = [...report.unitRows].filter((r) => r.rentAmount > 0).sort((a, b) => b.rentAmount - a.rentAmount)[0];
  if (largestRent) stats.push({ key: "largestRent", label: "أعلى إيجار", unitName: largestRent.unitName, value: formatMoney(largestRent.rentAmount) });

  const repairs = data.repairs.filter((r) => r.status !== "cancelled" && r.repairDate.startsWith(report.yearMonth) && (r.buildingId === buildingId || (r.unitId ? unitIds.has(r.unitId) : false)));
  const highestMaintenance = [...repairs].sort((a, b) => b.cost - a.cost)[0];
  if (highestMaintenance) {
    const unit = data.units.find((u) => u.id === highestMaintenance.unitId);
    stats.push({ key: "highestMaintenance", label: "أعلى مصروف صيانة", unitName: unit?.name, value: formatMoney(highestMaintenance.cost) });
  }

  const mostProfitable = [...report.unitRows].sort((a, b) => (b.collectedAmount - b.officeFeeAmount) - (a.collectedAmount - a.officeFeeAmount))[0];
  if (mostProfitable && mostProfitable.collectedAmount > 0) stats.push({ key: "mostProfitable", label: "الوحدة الأكثر ربحية", unitName: mostProfitable.unitName, value: formatMoney(mostProfitable.collectedAmount - mostProfitable.officeFeeAmount) });

  const highestOutstanding = [...report.unitRows].sort((a, b) => b.outstandingAmount - a.outstandingAmount)[0];
  if (highestOutstanding && highestOutstanding.outstandingAmount > 0) stats.push({ key: "highestOutstanding", label: "أعلى مبلغ مستحق", unitName: highestOutstanding.unitName, tenantName: highestOutstanding.tenantName, value: formatMoney(highestOutstanding.outstandingAmount) });

  const highestOfficeFee = [...report.unitRows].sort((a, b) => b.officeFeeAmount - a.officeFeeAmount)[0];
  if (highestOfficeFee && highestOfficeFee.officeFeeAmount > 0) stats.push({ key: "highestOfficeFee", label: "أعلى عمولة مكتب", unitName: highestOfficeFee.unitName, value: formatMoney(highestOfficeFee.officeFeeAmount) });

  const vacantUnits = data.units.filter((u) => u.buildingId === buildingId && u.status === "vacant");
  if (vacantUnits.length > 0) {
    const withLastEnd = vacantUnits.map((unit) => {
      const contracts = data.contracts.filter((c) => c.unitId === unit.id && !c.deletedAt);
      const lastEnd = contracts.map((c) => getContractEndDate(c)).filter((d): d is string => !!d).sort().pop();
      return { unit, lastEnd };
    });
    const longestVacant = withLastEnd.sort((a, b) => (a.lastEnd || "").localeCompare(b.lastEnd || ""))[0];
    if (longestVacant) {
      const days = longestVacant.lastEnd ? Math.abs(getDaysUntilDate(longestVacant.lastEnd) ?? 0) : null;
      stats.push({ key: "longestVacant", label: "الوحدة الأطول شغوراً", unitName: longestVacant.unit.name, value: days !== null ? `شاغرة منذ ${days} يوم` : "شاغرة" });
    }
  }

  return stats;
}
