// Shared task-status helpers to keep analytics consistent across the app.

export type NormalizedTaskStatus = 'todo' | 'in_progress' | 'done' | 'unknown';

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
  if (s === 'todo' || s === 'to_do' || s === 'to-do') return 'todo';

  return 'unknown';
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
