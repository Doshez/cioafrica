import { differenceInDays, isWeekend, addDays, parseISO } from 'date-fns';

/**
 * Calculate the number of working days (Monday-Friday) between two dates
 * @param startDate - Start date (string or Date)
 * @param endDate - End date (string or Date)
 * @returns Number of working days (excluding weekends)
 */
export function calculateWorkingDays(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined
): number {
  if (!startDate || !endDate) return 0;

  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  if (start > end) return 0;

  let workingDays = 0;
  let currentDate = start;

  while (currentDate <= end) {
    if (!isWeekend(currentDate)) {
      workingDays++;
    }
    currentDate = addDays(currentDate, 1);
  }

  return workingDays;
}

/**
 * Format working days for display
 * @param days - Number of working days
 * @returns Formatted string
 */
export function formatWorkingDays(days: number): string {
  if (days === 0) return '0 days';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/**
 * Calculate cost variance metrics
 */
export interface CostVariance {
  variance: number;
  variancePercentage: number;
  status: 'under' | 'on' | 'over';
  statusColor: string;
  statusLabel: string;
}

export function calculateCostVariance(
  estimatedCost: number,
  actualCost: number
): CostVariance {
  const variance = actualCost - estimatedCost;
  const variancePercentage = estimatedCost > 0 
    ? (variance / estimatedCost) * 100 
    : 0;

  let status: 'under' | 'on' | 'over';
  let statusColor: string;
  let statusLabel: string;

  if (Math.abs(variancePercentage) <= 5) {
    status = 'on';
    statusColor = 'text-yellow-600';
    statusLabel = '🟡 On Budget';
  } else if (variance < 0) {
    status = 'under';
    statusColor = 'text-green-600';
    statusLabel = '🟢 Under Budget';
  } else {
    status = 'over';
    statusColor = 'text-red-600';
    statusLabel = '🔴 Over Budget';
  }

  return {
    variance,
    variancePercentage,
    status,
    statusColor,
    statusLabel
  };
}
