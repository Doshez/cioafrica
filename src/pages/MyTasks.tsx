import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { useSearchParams } from "react-router-dom";
import { sendTaskCompletedNotification, getProjectManagers } from "@/hooks/useEmailNotifications";
import {
  TaskViewSwitcher,
  TaskListView,
  TaskKanbanView,
  TaskTableView,
  TaskCalendarView,
  TaskDetailDrawer,
  type ViewType,
  type TaskFilters,
  type TaskWithProfile
} from "@/components/tasks";
import { useViewPreference } from "@/hooks/useViewPreference";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  project_id: string;
  element_id: string | null;
  progress_percentage: number;
  projects: {
    name: string;
  } | null;
  elements: {
    id: string;
    title: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
}

export default function MyTasks() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { viewType, setViewType } = useViewPreference(undefined, undefined);
  const [selectedTask, setSelectedTask] = useState<TaskWithProfile | null>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  
  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all',
    myTasks: false,
    project: 'all'
  });

  useEffect(() => {
    if (user) {
      fetchMyTasks();
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'overdue') {
      setFilters(prev => ({ ...prev, status: 'overdue' }));
    }
  }, [searchParams]);

  const fetchMyTasks = async () => {
    try {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', user?.id);

      if (assignmentError) throw assignmentError;

      const assignedTaskIds = (assignmentData || []).map(a => a.task_id);

      const { data: legacyTasks, error: legacyError } = await supabase
        .from('tasks')
        .select('id')
        .eq('assignee_user_id', user?.id);

      if (legacyError) throw legacyError;

      const legacyTaskIds = (legacyTasks || []).map(t => t.id);
      const allTaskIds = [...new Set([...assignedTaskIds, ...legacyTaskIds])];

      if (allTaskIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          start_date,
          project_id,
          element_id,
          progress_percentage,
          projects (
            name
          ),
          elements (
            id,
            title
          )
        `)
        .in('id', allTaskIds)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  // Transform tasks to TaskWithProfile format
  const transformedTasks: TaskWithProfile[] = useMemo(() => {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      start_date: task.start_date || '',
      project_id: task.project_id,
      element_id: task.element_id,
      assignee_department_id: '',
      progress_percentage: task.progress_percentage,
      projects: task.projects,
      elements: task.elements
    }));
  }, [tasks]);

  // Filter tasks based on filters
  const filteredTasks = useMemo(() => {
    let filtered = transformedTasks;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(search) ||
        task.description?.toLowerCase().includes(search) ||
        task.elements?.title.toLowerCase().includes(search)
      );
    }

    if (filters.project && filters.project !== 'all') {
      filtered = filtered.filter(task => task.project_id === filters.project);
    }

    if (filters.status === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(task => 
        task.due_date && task.status !== 'done' && new Date(task.due_date) < today
      );
    } else if (filters.status !== 'all') {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    return filtered;
  }, [transformedTasks, filters]);

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      let newPercentage = task?.progress_percentage || 0;
      const previousStatus = task?.status;
      
      if (newStatus === 'todo') {
        newPercentage = 0;
      } else if (newStatus === 'in_progress' && newPercentage === 0) {
        newPercentage = 1;
      } else if (newStatus === 'done') {
        newPercentage = 100;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          progress_percentage: newPercentage,
          ...(newStatus === 'done' && { completed_at: new Date().toISOString() })
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus, progress_percentage: newPercentage } : t
      ));

      toast({
        title: "Success",
        description: "Task status updated successfully",
      });

      if (newStatus === 'done' && previousStatus !== 'done' && task && user) {
        sendTaskCompletionEmail(task);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendTaskCompletionEmail = async (task: Task) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .single();

      const { data: taskDetails } = await supabase
        .from('tasks')
        .select('assignee_department_id, departments!tasks_assignee_department_id_fkey(name)')
        .eq('id', task.id)
        .single();

      const departmentName = (taskDetails?.departments as any)?.name || 'General';
      const projectName = task.projects?.name || 'Project';
      const completedByName = profile?.full_name || 'Someone';

      const projectManagerIds = await getProjectManagers(task.project_id);

      await sendTaskCompletedNotification({
        task_id: task.id,
        task_name: task.title,
        department_name: departmentName,
        project_name: projectName,
        project_id: task.project_id,
        completed_by_name: completedByName,
        project_manager_ids: projectManagerIds,
      });
    } catch (error) {
      console.error('Error sending task completion notification:', error);
    }
  };

  const handleProgressUpdate = async (taskId: string, newProgress: number) => {
    try {
      let newStatus = 'todo';
      if (newProgress === 0) {
        newStatus = 'todo';
      } else if (newProgress > 0 && newProgress < 100) {
        newStatus = 'in_progress';
      } else if (newProgress === 100) {
        newStatus = 'done';
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          progress_percentage: newProgress,
          status: newStatus,
          ...(newStatus === 'done' && { completed_at: new Date().toISOString() })
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, progress_percentage: newProgress, status: newStatus } : task
      ));

      toast({
        title: "Success",
        description: "Task progress updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDateUpdate = async (taskId: string, field: 'due_date' | 'start_date', newDate: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ [field]: newDate })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, [field]: newDate } : task
      ));

      toast({
        title: "Success",
        description: "Task date updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditTask = (task: TaskWithProfile) => {
    setSelectedTask(task);
  };

  const handleTaskUpdate = async (updates: Partial<TaskWithProfile>) => {
    if (!selectedTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', selectedTask.id);

      if (error) throw error;

      setTasks(tasks.map(task =>
        task.id === selectedTask.id
          ? { ...task, ...updates }
          : task
      ));

      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderView = () => {
    if (filteredTasks.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {filters.search || filters.project !== 'all' || filters.status !== 'all'
                ? "No tasks found matching your filters"
                : "No tasks assigned to you yet"}
            </p>
          </CardContent>
        </Card>
      );
    }

    const commonProps = {
      tasks: filteredTasks,
      onStatusUpdate: handleStatusUpdate,
      onProgressUpdate: handleProgressUpdate,
      onDateUpdate: handleDateUpdate,
      onEditTask: handleEditTask,
      canEdit: true,
      showProject: true
    };

    switch (viewType) {
      case 'kanban':
        return <TaskKanbanView {...commonProps} />;
      case 'table':
        return <TaskTableView {...commonProps} />;
      case 'calendar':
        return <TaskCalendarView {...commonProps} />;
      default:
        return <TaskListView {...commonProps} groupByElement={true} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground mt-2">
            Tasks assigned to you across all projects
          </p>
        </div>
        {isAdmin && <CreateTaskDialog onTaskCreated={fetchMyTasks} showTrigger={false} />}
      </div>

      {/* View Switcher & Filters */}
      <TaskViewSwitcher
        viewType={viewType}
        onViewChange={setViewType}
        filters={filters}
        onFiltersChange={setFilters}
        currentUserId={user?.id}
        projects={projects}
        showProjectFilter={true}
      />

      {/* Task Views */}
      {renderView()}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
        canEdit={true}
      />

      {/* Legacy Edit Task Dialog (for full editing) */}
      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onSuccess={fetchMyTasks}
        />
      )}
    </div>
  );
}
