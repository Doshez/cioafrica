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

  // Parse dates and normalize to start of day to avoid timezone issues
  const start = typeof startDate === 'string' ? parseISO(startDate.split('T')[0]) : new Date(startDate.toISOString().split('T')[0]);
  const end = typeof endDate === 'string' ? parseISO(endDate.split('T')[0]) : new Date(endDate.toISOString().split('T')[0]);

  if (start > end) return 0;

  let workingDays = 0;
  let currentDate = start;

  // Include both start and end dates in the count
  while (currentDate <= end) {
    if (!isWeekend(currentDate)) {
      workingDays++;
    }
    currentDate = addDays(currentDate, 1);
  }

  return workingDays;
}

/**
 * Compute working days for a task object
 */
export function computeTaskWorkingDays(task: { start_date: string | null; due_date: string | null }): number {
  return calculateWorkingDays(task.start_date, task.due_date);
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
  variancePercentage: number | null;
  status: 'under' | 'on' | 'over' | 'na';
  statusColor: string;
  statusLabel: string;
}

export function calculateCostVariance(
  estimatedCost: number,
  actualCost: number
): CostVariance {
  // Handle edge case: no estimate provided
  if (estimatedCost === 0 || estimatedCost === null || estimatedCost === undefined) {
    return {
      variance: actualCost,
      variancePercentage: null,
      status: 'na',
      statusColor: 'text-muted-foreground',
      statusLabel: 'N/A'
    };
  }

  const variance = actualCost - estimatedCost;
  const variancePercentage = (variance / estimatedCost) * 100;

  let status: 'under' | 'on' | 'over' | 'na';
  let statusColor: string;
  let statusLabel: string;

  // Threshold: ±5% is "On Budget"
  if (actualCost < estimatedCost * 0.95) {
    status = 'under';
    statusColor = 'text-green-600';
    statusLabel = '🟢 Under Budget';
  } else if (actualCost <= estimatedCost * 1.05) {
    status = 'on';
    statusColor = 'text-yellow-600';
    statusLabel = '🟡 On Budget';
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

/**
 * Enhanced task analytics computed fields
 */
export interface TaskAnalytics {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: string;
  progress: number;
  estimated_cost: number;
  actual_cost: number;
  working_days: number;
  cost_variance: number;
  cost_variance_pct: number | null;
  budget_status: 'under' | 'on' | 'over' | 'na';
  budget_status_label: string;
  budget_status_color: string;
}

/**
 * Compute all analytics fields for a task
 */
export function computeTaskAnalytics(task: {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: string;
  progress?: number;
  estimated_cost?: number;
  actual_cost?: number;
}): TaskAnalytics {
  const estimatedCost = task.estimated_cost || 0;
  const actualCost = task.actual_cost || 0;
  const workingDays = computeTaskWorkingDays(task);
  const costVariance = calculateCostVariance(estimatedCost, actualCost);

  return {
    id: task.id,
    title: task.title,
    start_date: task.start_date,
    due_date: task.due_date,
    status: task.status,
    progress: task.progress || 0,
    estimated_cost: estimatedCost,
    actual_cost: actualCost,
    working_days: workingDays,
    cost_variance: costVariance.variance,
    cost_variance_pct: costVariance.variancePercentage,
    budget_status: costVariance.status,
    budget_status_label: costVariance.statusLabel,
    budget_status_color: costVariance.statusColor
  };
}

/**
 * Aggregate KPIs from task analytics
 */
export interface ProjectKPIs {
  totalEstimatedCost: number;
  totalActualCost: number;
  overallCostVariance: number;
  overallCostVariancePct: number | null;
  averageWorkingDays: number;
  projectCompletionPct: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
}

export function computeProjectKPIs(tasks: TaskAnalytics[]): ProjectKPIs {
  const totalEstimatedCost = tasks.reduce((sum, t) => sum + t.estimated_cost, 0);
  const totalActualCost = tasks.reduce((sum, t) => sum + t.actual_cost, 0);
  const overallCostVariance = totalActualCost - totalEstimatedCost;
  const overallCostVariancePct = totalEstimatedCost > 0 
    ? (overallCostVariance / totalEstimatedCost) * 100 
    : null;

  const totalWorkingDays = tasks.reduce((sum, t) => sum + t.working_days, 0);
  const averageWorkingDays = tasks.length > 0 ? totalWorkingDays / tasks.length : 0;

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const notStartedTasks = tasks.filter(t => t.status === 'todo' || t.status === 'not_started').length;
  const totalTasks = tasks.length;
  const projectCompletionPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return {
    totalEstimatedCost,
    totalActualCost,
    overallCostVariance,
    overallCostVariancePct,
    averageWorkingDays,
    projectCompletionPct,
    totalTasks,
    completedTasks,
    inProgressTasks,
    notStartedTasks
  };
}

/**
 * Budget status distribution for pie charts
 */
export interface BudgetStatusDistribution {
  underBudget: number;
  onBudget: number;
  overBudget: number;
  na: number;
}

export function computeBudgetStatusDistribution(tasks: TaskAnalytics[]): BudgetStatusDistribution {
  return {
    underBudget: tasks.filter(t => t.budget_status === 'under').length,
    onBudget: tasks.filter(t => t.budget_status === 'on').length,
    overBudget: tasks.filter(t => t.budget_status === 'over').length,
    na: tasks.filter(t => t.budget_status === 'na').length
  };
}
