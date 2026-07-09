import type { EjarImportData, EjarImportPayment } from "@/data/types";

type Log = (message: string, ...args: unknown[]) => void;

const SECTION_HEADINGS = [
  /Contract Data/i, /بيانات\s+العقد/,
  /Lessor Representative Data/i, /بيانات\s+ممثل\s+المؤجر/,
  /Lessor Data/i, /بيانات\s+المؤجر/,
  /Tenant Representative Data/i, /بيانات\s+ممثل\s+المستأجر/,
  /Tenant Data/i, /بيانات\s+المستأجر/,
  /Brokerage Entity(?: and Broker)? Data/i, /بيانات\s+منشأة\s+الوساطة\s+العقارية/,
  /Ownership document Data/i, /بيانات\s+مستندات\s+الملكية/,
  /Rental Units Data/i, /بيانات\s+الوحدات\s+الإيجارية/,
  /Property Data/i, /بيانات\s+العقار/,
  /Financial Data/i, /البيانات\s+المالية/,
  /Rent Payments Schedule/i, /جدول\s+سداد\s+الدفعات/,
  /Obligations by Parties/i, /التزامات\s+الأطراف/,
];

export function extractSection(text: string, startPatterns: RegExp[], endPatterns: RegExp[]): string {
  const startMatches = startPatterns
    .map((pattern) => pattern.exec(text))
    .filter((match): match is RegExpExecArray => !!match && match.index >= 0);
  if (!startMatches.length) return "";
  const first = startMatches.reduce((earliest, match) => match.index < earliest.index ? match : earliest);
  const afterStart = text.slice(first.index);
  const endIndexes = endPatterns
    .map((pattern) => pattern.exec(afterStart)?.index ?? -1)
    .filter((index) => index > first[0].length);
  const end = endIndexes.length ? Math.min(...endIndexes) : afterStart.length;
  return afterStart.slice(0, end).trim();
}

function section(text: string, starts: RegExp[], extraEnds: RegExp[] = []): string {
  const ownStarts = starts.map((pattern) => new RegExp(pattern.source, pattern.flags.replace("g", "")));
  const ends = [...extraEnds, ...SECTION_HEADINGS]
    .filter((pattern) => !starts.some((start) => start.source === pattern.source))
    .map((pattern) => new RegExp(pattern.source, pattern.flags.replace("g", "")));
  return extractSection(text, ownStarts, ends);
}

export function isCorruptedArabic(value: string | undefined): boolean {
  if (!value) return true;
  if (/[ØÙÃÂ�]|\uFFFD/.test(value)) return true;
  if (/NimbusSans|\bFont\b|\b(?:obj|endobj)\b/i.test(value)) return true;
  return false;
}

function clean(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/^[\s:|\-–—]+|[\s:|\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractValue(sectionText: string, labels: string[], maxLength = 160): string | undefined {
  if (!sectionText) return undefined;
  const lines = sectionText.split(/\n/).map(clean).filter(Boolean);
  for (const label of labels) {
    const labelPattern = new RegExp(escapeRegExp(label), "i");
    for (let index = 0; index < lines.length; index++) {
      const match = labelPattern.exec(lines[index]);
      if (!match) continue;
      let remainder = clean(lines[index].slice(match.index + match[0].length));
      if (remainder && remainder.length <= maxLength && !SECTION_HEADINGS.some((heading) => heading.test(remainder))) {
        return remainder;
      }
      let preceding = clean(lines[index].slice(0, match.index));
      if (preceding && preceding.length <= maxLength && !SECTION_HEADINGS.some((heading) => heading.test(preceding))) {
        return preceding;
      }
      const next = lines[index + 1];
      if (next && next.length <= maxLength && !SECTION_HEADINGS.some((heading) => heading.test(next))) {
        return next;
      }
    }
  }
  return undefined;
}

function extractNumber(sectionText: string, labels: string[]): string | undefined {
  const value = extractValue(sectionText, labels, 80);
  return value?.match(/[0-9٠-٩][0-9٠-٩,]*(?:\.[0-9٠-٩]+)?/)?.[0]?.replace(/,/g, "");
}

function extractDate(sectionText: string, labels: string[]): string | undefined {
  const value = extractValue(sectionText, labels, 100);
  return value?.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
}

function extractContractNumber(contractSection: string): string | undefined {
  const patterns = [
    /رقم\s+سجل\s+العقد[:\t ]*([0-9\-\/\t ]+)/,
    /Contract\s+No\.?[:\t ]*([0-9\-\/\t ]+)/i,
    /No\s+Contract[:\t ]*([0-9\-\/\t ]+)/i,
    /([0-9][0-9\-\/\t ]+)[:\t ]*رقم\s+سجل\s+العقد/,
    /([0-9][0-9\-\/\t ]+)[:\t ]*Contract\s+No\.?/i,
  ];
  for (const pattern of patterns) {
    const match = contractSection.match(pattern);
    if (match?.[1]) return clean(match[1]).replace(/\s+/g, " ");
  }
  return undefined;
}

function paymentCycle(financialSection: string): string | undefined {
  const value = extractValue(financialSection, [
    "دورة سداد الإيجار", "دورة سداد الايجار", "دورة الدفع", "Payment Cycle", "Rent payment cycle",
  ], 80) || financialSection;
  if (/ربع(?:ي|\s+سنوي)|quarterly/i.test(value)) return "quarterly";
  if (/نصف\s+سنوي|semi[- ]?annual/i.test(value)) return "semi_annual";
  if (/شهري|monthly/i.test(value)) return "monthly";
  if (/مرن|flexible/i.test(value)) return "flexible";
  if (/سنوي|annual|yearly/i.test(value)) return "annual";
  return undefined;
}

export function parsePaymentSchedule(scheduleText: string): EjarImportPayment[] {
  if (!scheduleText) return [];
  const lines = scheduleText.split(/\n/).map(clean).filter(Boolean);
  const rows: string[] = [];
  let pending = "";

  for (const line of lines) {
    const hasDate = /\b20\d{2}-\d{2}-\d{2}\b/.test(line);
    const hasAmount = /\b(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\b/.test(line);
    if (hasDate && hasAmount) {
      if (pending) pending = clean(`${pending} ${line}`);
      rows.push(pending || line);
      pending = "";
    } else if (hasDate || pending) {
      pending = clean(`${pending} ${line}`);
    }
  }
  if (pending) rows.push(pending);

  const payments: EjarImportPayment[] = [];
  for (const row of rows) {
    const dates = [...row.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)].map((match) => match[0]);
    if (!dates.length) continue;
    const withoutDates = row.replace(/\b(?:20|14)\d{2}-\d{2}-\d{2}\b/g, " ");
    const monetary = [...withoutDates.matchAll(/\b(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\b/g)]
      .map((match) => match[0].replace(/,/g, ""));
    if (!monetary.length) continue;
    const firstNumber = row.match(/^\s*(\d{1,3})(?:\s|\|)/)?.[1];
    payments.push({
      paymentNumber: firstNumber ? Number(firstNumber) : payments.length + 1,
      dueDateGregorian: dates[0],
      paymentDeadlineGregorian: dates[1],
      amount: monetary[monetary.length - 1],
      status: "unpaid",
    });
  }
  return payments;
}

function extractContractDates(contractSection: string) {
  const allDates = [...contractSection.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)]
    .map((match) => match[0].trim());
  const uniqueDates = [...new Set(allDates)];
  const contractSealingDate = extractDate(contractSection, [
    "تاريخ إبرام العقد", "Contract Sealing Date",
  ]) || uniqueDates[0];
  const startDate = extractDate(contractSection, [
    "تاريخ بداية مدة الإيجار", "تاريخ بداية العقد", "Tenancy Start Date", "Start Date",
  ]) || contractSealingDate;
  const laterDates = startDate
    ? uniqueDates.filter((date) => date > startDate).sort((left, right) => right.localeCompare(left))
    : [];
  const labeledEnd = extractDate(contractSection, [
    "تاريخ نهاية مدة الإيجار", "تاريخ نهاية العقد", "Tenancy End Date", "End Date",
  ]);
  const endDate = labeledEnd && startDate && labeledEnd > startDate ? labeledEnd : laterDates[0];
  return { contractSealingDate, startDate, endDate };
}

export function parseEjarContractText(text: string, _log: Log = console.log): EjarImportData {
  const contractSection = section(text, [/Contract Data/i, /بيانات\s+العقد/]);
  const unitSection = section(text, [/Rental Units Data/i, /بيانات\s+الوحدات\s+الإيجارية/]);
  const financialSection = section(text, [/Financial Data/i, /البيانات\s+المالية/], [/Rent Payments Schedule/i, /جدول\s+سداد\s+الدفعات/]);
  const paymentScheduleSection = extractSection(text, [/Rent Payments Schedule/i, /جدول\s+سداد\s+الدفعات/], [/Obligations by Parties/i, /التزامات\s+الأطراف/]);

  const contractDates = extractContractDates(contractSection);

  const warnings: string[] = [];
  if (!contractDates.endDate || contractDates.endDate === contractDates.startDate) {
    warnings.push("تاريخ نهاية العقد يحتاج مراجعة");
  }

  return {
    contract: {
      contractNumber: extractContractNumber(contractSection),
      startDate: contractDates.startDate,
      endDate: contractDates.endDate,
      expiryReminderDays: 60,
      autoRenewal: /تجديد\s+تلقائي|auto renewal/i.test(contractSection),
    },
    tenant: {},
    lessor: {},
    broker: {},
    ownership: {},
    property: {},
    unit: {
      electricityMeterNumber: extractValue(unitSection, ["رقم عداد الكهرباء", "Electricity Meter Number"], 100),
      waterMeterNumber: extractValue(unitSection, ["رقم عداد المياه", "Water Meter Number"], 100),
    },
    financial: {
      annualRent: extractNumber(financialSection, ["الإيجار السنوي", "قيمة الإيجار", "Annual Rent"]),
      regularPaymentAmount: extractNumber(financialSection, ["دفعة الإيجار الدورية", "قيمة الدفعة", "Regular Rent Payment", "Payment Amount"]),
      paymentCycle: paymentCycle(financialSection),
      numberOfPayments: extractNumber(financialSection, ["عدد دفعات الإيجار", "عدد الدفعات", "Number of Payments"]),
      totalContractValue: extractNumber(financialSection, ["إجمالي قيمة العقد", "اجمالي قيمة العقد", "Total Contract Value"]),
    },
    payments: parsePaymentSchedule(paymentScheduleSection),
    warnings,
    reviewFields: [],
  };
}
