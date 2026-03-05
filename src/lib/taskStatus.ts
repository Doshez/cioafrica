// Shared task-status helpers to keep analytics consistent across the app.

// The canonical task statuses used throughout the system
export const TASK_STATUSES = [
  { value: 'todo', label: 'Not Started', color: 'text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', color: 'text-primary' },
  { value: 'review', label: 'Review', color: 'text-warning' },
  { value: 'done', label: 'Completed', color: 'text-success' },
  { value: 'blocked', label: 'Blocked', color: 'text-destructive' },
] as const;

export type NormalizedTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked' | 'unknown';

export function normalizeTaskStatus(status: string | null | undefined): NormalizedTaskStatus {
  const s = (status ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  if (!s) return 'unknown';

  if (s === 'done' || s === 'completed' || s === 'complete') return 'done';
  if (s === 'in_progress' || s === 'inprogress' || s === 'in_process') return 'in_progress';
  if (s === 'review' || s === 'in_review') return 'review';
  if (s === 'blocked') return 'blocked';
  if (s === 'todo' || s === 'to_do' || s === 'not_started') return 'todo';

  return 'unknown';
}

export function getStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeTaskStatus(status);
  const found = TASK_STATUSES.find(s => s.value === normalized);
  return found?.label || 'Unknown';
}

export function isTaskDoneStatus(status: string | null | undefined): boolean {
  return normalizeTaskStatus(status) === 'done';
}

export function isTaskInProgressStatus(status: string | null | undefined): boolean {
  return normalizeTaskStatus(status) === 'in_progress';
}

export function isTaskTodoStatus(status: string | null | undefined): boolean {
  const normalized = normalizeTaskStatus(status);
  return normalized === 'todo' || normalized === 'unknown';
}

export function isTaskBlockedStatus(status: string | null | undefined): boolean {
  return normalizeTaskStatus(status) === 'blocked';
}

export function isTaskReviewStatus(status: string | null | undefined): boolean {
  return normalizeTaskStatus(status) === 'review';
}
