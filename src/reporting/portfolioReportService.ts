import { AppData } from "@/data/types";
import { generateMonthlyReport } from "./financialReportEngine";
import { currentYearMonth, shiftYearMonth } from "./dateUtils";
import { MonthlyReport } from "./types";

/**
 * PortfolioReportService — engine-driven replacement for the legacy
 * payment-grouped monthlyOfficeCollectionReport(). Every number comes from the
 * same contract-driven MonthlyReport used everywhere else, so the Reports page
 * can never disagree with a building's own monthly report.
 */

export interface PortfolioMonthRow {
  key: string;
  buildingId: string;
  propertyName: string;
  yearMonth: string;
  year: number;
  month: number;
  report: MonthlyReport;
}

/**
 * Rows for the last `monthsBack` months (newest first), one per building per
 * month, skipping months where a building had no expected rent and no cash.
 */
export function buildPortfolioMonthlyRows(data: AppData, monthsBack = 6): PortfolioMonthRow[] {
  const rows: PortfolioMonthRow[] = [];
  let ym = currentYearMonth();
  for (let i = 0; i < monthsBack; i++) {
    for (const building of data.buildings) {
      const report = generateMonthlyReport(data, building.id, ym);
      if (report.expectedRent <= 0 && report.collectedForMonth <= 0 && report.lateCollectionsAmount <= 0) continue;
      rows.push({
        key: `${building.id}|${ym}`,
        buildingId: building.id,
        propertyName: building.name,
        yearMonth: ym,
        year: Number(ym.slice(0, 4)),
        month: Number(ym.slice(5, 7)),
        report,
      });
    }
    ym = shiftYearMonth(ym, -1);
  }
  return rows;
}
