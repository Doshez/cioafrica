export interface AssignedUser {
  id: string;
  name: string;
  email?: string;
}

export interface TaskWithProfile {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
  assignee_user_id?: string;
  description?: string;
  progress_percentage?: number;
  estimate_hours?: number;
  logged_hours?: number;
  assigned_users?: AssignedUser[];
  element_id?: string;
  element_name?: string;
  project_id?: string;
}

export interface Element {
  id: string;
  title: string;
  description?: string;
}

export type ViewType = 'list' | 'kanban' | 'table' | 'calendar';

export interface TaskViewProps {
  tasks: TaskWithProfile[];
  elements?: Element[];
  onStatusUpdate: (taskId: string, status: string) => void;
  onProgressUpdate: (taskId: string, progress: number) => void;
  onDateUpdate?: (taskId: string, field: 'start_date' | 'due_date', date: string) => void;
  onEditTask?: (task: TaskWithProfile) => void;
  onDeleteTask?: (taskId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface TaskFilters {
  search: string;
  status: string;
  priority: string;
  assignee: string;
  myTasks: boolean;
}
