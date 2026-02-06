import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { CreateElementDialog } from '@/components/CreateElementDialog';
import { ImportTasksDialog } from '@/components/ImportTasksDialog';
import { ProjectLoadingScreen } from '@/components/ProjectLoadingScreen';
import { DepartmentGanttView } from '@/components/DepartmentGanttView';
import { TasksByElementView } from '@/components/TasksByElementView';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { EditElementDialog } from '@/components/EditElementDialog';
import { EditDepartmentDialog } from '@/components/EditDepartmentDialog';
import { DepartmentDocumentBrowser } from '@/components/documents/DepartmentDocumentBrowser';
import { ExternalUsersManager } from '@/components/documents/ExternalUsersManager';
import { DepartmentLeadDialog } from '@/components/DepartmentLeadDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useDepartmentLead } from '@/hooks/useDepartmentLead';
import { useViewPreference } from '@/hooks/useViewPreference';
import { ArrowLeft, Plus, Filter, Calendar, Clock, Search, Trash2, Edit as EditIcon, MoreVertical, Folder, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { isTaskDoneStatus, isTaskInProgressStatus, isTaskTodoStatus } from '@/lib/taskStatus';
import {
  TaskViewSwitcher,
  TaskKanbanView,
  TaskTableView,
  TaskCalendarView,
  TaskDetailDrawer,
  type ViewType,
  type TaskFilters,
  type TaskWithProfile as TaskType,
} from '@/components/tasks';

interface Department {
  id: string;
  name: string;
  description: string;
  project_id: string;
}

interface Project {
  id: string;
  name: string;
}

interface Task {
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
}

interface AssignedUser {
  id: string;
  name: string;
  email?: string;
}

interface TaskWithProfile extends Task {
  assignee_name?: string;
  assignee_email?: string;
  assigned_users?: AssignedUser[];
  element_id?: string;
  element_name?: string;
}

interface Element {
  id: string;
  title: string;
  description?: string;
}

interface DepartmentAnalytics {
  department_id: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
}

export default function DepartmentGantt() {
  const { departmentId, projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isProjectManager } = useUserRole();
  const { isCurrentUserLead } = useDepartmentLead(departmentId);
  const { viewType, setViewType } = useViewPreference(departmentId);

  const [department, setDepartment] = useState<Department | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [analytics, setAnalytics] = useState<DepartmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all',
    myTasks: false,
  });
  const [editingTask, setEditingTask] = useState<any>(null);
  const [drawerTask, setDrawerTask] = useState<TaskType | null>(null);
  const [editingElement, setEditingElement] = useState<{ id: string; title: string; description?: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasAssignedTasks, setHasAssignedTasks] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<{ id: string; name: string; description?: string } | null>(null);

  useEffect(() => {
    if (departmentId && projectId) {
      fetchData();
    }
  }, [departmentId, projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Fetch department and project in parallel
      const [deptResult, projectResult] = await Promise.all([
        supabase.from('departments').select('*').eq('id', departmentId).maybeSingle(),
        supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle()
      ]);

      if (deptResult.error) throw deptResult.error;
      if (projectResult.error) throw projectResult.error;
      
      // Check if user has access to this department
      if (!deptResult.data) {
        toast({
          title: 'Access Denied',
          description: 'You do not have access to this department.',
          variant: 'destructive',
        });
        navigate(`/projects/${projectId}`);
        return;
      }
      
      if (!projectResult.data) {
        toast({
          title: 'Error',
          description: 'Project not found',
          variant: 'destructive',
        });
        navigate('/projects');
        return;
      }
      
      setDepartment(deptResult.data);
      setProject(projectResult.data);

      await fetchTasksAndAnalytics(user?.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      navigate(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksAndAnalytics = async (userId?: string) => {
    try {
      // Fetch elements, tasks, and analytics in parallel
      const [elementsResult, tasksResult, analyticsResult] = await Promise.all([
        supabase.from('elements').select('id, title, description').eq('department_id', departmentId).order('created_at', { ascending: true }),
        supabase.from('tasks').select('*, element:elements(id, title)').eq('project_id', projectId).eq('assignee_department_id', departmentId).order('start_date', { ascending: true }),
        supabase.from('department_analytics').select('*').eq('department_id', departmentId).maybeSingle()
      ]);

      if (elementsResult.error) throw elementsResult.error;
      if (tasksResult.error) throw tasksResult.error;
      
      setElements(elementsResult.data || []);
      const tasksData = tasksResult.data || [];

      // Fetch task assignments first
      const taskIds = tasksData.map(task => task.id);
      const assignmentsResult = taskIds.length > 0 
        ? await supabase.from('task_assignments').select('task_id, user_id').in('task_id', taskIds) 
        : { data: [] };

      // Collect all user IDs from assignments AND legacy assignee_user_id
      const allUserIds = [
        ...new Set([
          ...(assignmentsResult.data || []).map(a => a.user_id),
          ...tasksData.map(t => t.assignee_user_id).filter(Boolean)
        ])
      ];

      // Fetch all profiles for these users
      const profilesResult = allUserIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', allUserIds)
        : { data: [] };

      // Map tasks with profiles
      const tasksWithProfiles: TaskWithProfile[] = tasksData.map(task => {
        const taskAssignments = assignmentsResult.data?.filter(a => a.task_id === task.id) || [];
        const assignedUsers = taskAssignments.map(assignment => {
          const profile = profilesResult.data?.find(p => p.id === assignment.user_id);
          return {
            id: assignment.user_id,
            name: profile?.full_name || profile?.email || 'Unknown User',
            email: profile?.email,
          };
        });
        
        const legacyProfile = task.assignee_user_id ? profilesResult.data?.find(p => p.id === task.assignee_user_id) : null;
        
        return {
          ...task,
          assigned_users: assignedUsers,
          assignee_name: legacyProfile?.full_name || legacyProfile?.email,
          assignee_email: legacyProfile?.email,
          element_id: (task.element as any)?.id,
          element_name: (task.element as any)?.title,
        };
      });

      setTasks(tasksWithProfiles);

      // Check user access - also check task_assignments
      if (userId && !isAdmin && !isProjectManager) {
        setHasAssignedTasks(tasksWithProfiles.some(task => 
          task.assignee_user_id === userId || 
          task.assigned_users?.some(u => u.id === userId)
        ));
      } else {
        setHasAssignedTasks(true);
      }

      setAnalytics(analyticsResult.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Compute local analytics from actual tasks (always in sync)
  const completedCount = tasks.filter(t => isTaskDoneStatus(t.status)).length;
  const computedAnalytics = {
    department_id: departmentId || '',
    total_tasks: tasks.length,
    completed_tasks: completedCount,
    in_progress_tasks: tasks.filter(t => isTaskInProgressStatus(t.status)).length,
    todo_tasks: tasks.filter(t => isTaskTodoStatus(t.status)).length,
    completion_percentage: tasks.length > 0
      ? Math.round((completedCount / tasks.length) * 100)
      : 0,
  };

  // Filter tasks based on user role, assignment, and user filters
  const filteredTasks = tasks.filter(task => {
    // First apply role-based visibility filter
    // Admins and project managers can see all tasks
    // Regular users can only see tasks assigned to them
    if (!isAdmin && !isProjectManager && !isCurrentUserLead && currentUserId) {
      const isAssignedViaAssignments = task.assigned_users?.some(u => u.id === currentUserId);
      const isAssignedLegacy = task.assignee_user_id === currentUserId;
      if (!isAssignedViaAssignments && !isAssignedLegacy) {
        return false;
      }
    }
    
    // Apply "My Tasks" filter
    if (filters.myTasks && currentUserId) {
      const isAssignedViaAssignments = task.assigned_users?.some(u => u.id === currentUserId);
      const isAssignedLegacy = task.assignee_user_id === currentUserId;
      if (!isAssignedViaAssignments && !isAssignedLegacy) {
        return false;
      }
    }
    
    // Then apply user-selected filters
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    const currentTask = tasks.find(t => t.id === taskId);
    // Guard: don't update if status is already the same
    if (!currentTask || currentTask.status === newStatus) return;

    // Sync percentage with status
    let newPercentage = currentTask.progress_percentage || 0;
    
    if (newStatus === 'todo') {
      newPercentage = 0;
    } else if (newStatus === 'in_progress' && newPercentage === 0) {
      newPercentage = 1;
    } else if (newStatus === 'done') {
      newPercentage = 100;
    }

    // Optimistically update local state
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: newStatus,
              progress_percentage: newPercentage,
              completed_at: newStatus === 'done' ? new Date().toISOString() : null
            } 
          : task
      )
    );

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          progress_percentage: newPercentage,
          completed_at: newStatus === 'done' ? new Date().toISOString() : null 
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task status updated successfully',
      });

      // Silently refresh analytics without showing loading
      const { data: analyticsData } = await supabase
        .from('department_analytics')
        .select('*')
        .eq('department_id', departmentId)
        .single();
      
      if (analyticsData) setAnalytics(analyticsData);
    } catch (error: any) {
      // Revert optimistic update on error
      fetchData();
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleProgressUpdate = async (taskId: string, progress: number) => {
    const currentTask = tasks.find(t => t.id === taskId);
    // Guard: don't update if progress is already the same
    if (!currentTask || currentTask.progress_percentage === progress) return;

    // Determine new status based on progress
    let newStatus = 'todo';
    let completedAt = null;
    
    if (progress === 0) {
      newStatus = 'todo';
    } else if (progress > 0 && progress < 100) {
      newStatus = 'in_progress';
    } else if (progress === 100) {
      newStatus = 'done';
      completedAt = new Date().toISOString();
    }

    // Optimistically update local state
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              progress_percentage: progress,
              status: newStatus,
              completed_at: completedAt
            } 
          : task
      )
    );

    try {
      const updateData: any = { 
        progress_percentage: progress,
        status: newStatus,
        completed_at: completedAt
      };

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: progress === 100 ? 'Task completed!' : 'Progress updated successfully',
      });

      // Silently refresh analytics without showing loading
      const { data: analyticsData } = await supabase
        .from('department_analytics')
        .select('*')
        .eq('department_id', departmentId)
        .single();
      
      if (analyticsData) setAnalytics(analyticsData);
    } catch (error: any) {
      // Revert optimistic update on error
      fetchData();
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDateUpdate = async (taskId: string, field: 'start_date' | 'due_date', date: string) => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask || currentTask[field] === date) return;

    // Optimistically update local state
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, [field]: date } 
          : task
      )
    );

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ [field]: date || null })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Date updated successfully',
      });
    } catch (error: any) {
      // Revert optimistic update on error
      fetchData();
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteElement = async (elementId: string) => {
    try {
      const { error } = await supabase
        .from('elements')
        .delete()
        .eq('id', elementId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Element deleted successfully',
      });

      fetchTasksAndAnalytics();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task deleted successfully',
      });

      fetchTasksAndAnalytics();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDepartment = async () => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Department deleted successfully',
      });

      navigate(`/projects/${projectId}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <ProjectLoadingScreen projectId={projectId} />;
  }

  if (!department || !project) {
    return <div className="p-8">Department or project not found</div>;
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 sm:pb-4 gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">{department.name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{project.name}</p>
            {department.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{department.description}</p>
            )}
          </div>
        </div>
        {(isAdmin || isProjectManager) && (
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <DepartmentLeadDialog
              departmentId={departmentId!}
              departmentName={department.name}
              projectId={projectId!}
            />
            <ImportTasksDialog
              projectId={projectId}
              departmentId={departmentId}
              onTasksImported={fetchTasksAndAnalytics}
            />
            <CreateElementDialog
              projectId={projectId}
              departmentId={departmentId}
              onElementCreated={fetchTasksAndAnalytics}
            />
            <CreateTaskDialog
              projectId={projectId}
              departmentId={departmentId}
              onTaskCreated={fetchTasksAndAnalytics}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingDepartment(department)}>
                  <EditIcon className="h-4 w-4 mr-2" />
                  Edit Department
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeletingDepartment(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Department
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
              <p className="text-3xl font-bold">{computedAnalytics.total_tasks}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">To Do</p>
              <p className="text-3xl font-bold text-muted-foreground">{computedAnalytics.todo_tasks}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">In Progress</p>
              <p className="text-3xl font-bold text-primary">{computedAnalytics.in_progress_tasks}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">{computedAnalytics.completed_tasks}</p>
              <div className="space-y-1">
                <Progress value={computedAnalytics.completion_percentage} className="h-2" />
                <p className="text-xs text-muted-foreground">{computedAnalytics.completion_percentage}% Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasAssignedTasks && !isAdmin && !isProjectManager && !isCurrentUserLead && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              You are viewing this department in read-only mode. You can see the Gantt chart but cannot view or edit task details as you are not assigned to any tasks in this department.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={hasAssignedTasks || isAdmin || isProjectManager || isCurrentUserLead ? "tasks" : "gantt"} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="tasks" disabled={!hasAssignedTasks && !isAdmin && !isProjectManager && !isCurrentUserLead}>
            Tasks
          </TabsTrigger>
          <TabsTrigger value="gantt">Gantt Chart</TabsTrigger>
          <TabsTrigger value="documents">
            <Folder className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          {(isAdmin || isProjectManager || isCurrentUserLead) && (
            <TabsTrigger value="external-users">
              <Users className="h-4 w-4 mr-2" />
              External Access
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {/* View Switcher and Filters */}
          <Card>
            <CardContent className="pt-6">
              <TaskViewSwitcher
                viewType={viewType}
                onViewChange={setViewType}
                filters={filters}
                onFiltersChange={setFilters}
                currentUserId={currentUserId || undefined}
              />
            </CardContent>
          </Card>

          {/* Render the selected view */}
          {filteredTasks.length === 0 && elements.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No tasks found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or create a new task</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewType === 'list' && (
                <TasksByElementView
                  tasks={filteredTasks}
                  elements={elements}
                  onStatusUpdate={handleStatusUpdate}
                  onProgressUpdate={handleProgressUpdate}
                  onEditTask={(task) => setDrawerTask(task as TaskType)}
                  onEditElement={(id, name) => {
                    const element = elements.find(e => e.id === id);
                    if (element) {
                      setEditingElement({ id, title: name, description: element.description });
                    }
                  }}
                  onDeleteElement={handleDeleteElement}
                  onDeleteTask={handleDeleteTask}
                  canDelete={isAdmin || isProjectManager}
                />
              )}

              {viewType === 'kanban' && (
                <TaskKanbanView
                  tasks={filteredTasks}
                  elements={elements}
                  onStatusUpdate={handleStatusUpdate}
                  onProgressUpdate={handleProgressUpdate}
                  onEditTask={(task) => setDrawerTask(task as TaskType)}
                  canEdit={isAdmin || isProjectManager || isCurrentUserLead || hasAssignedTasks}
                />
              )}

              {viewType === 'table' && (
                <TaskTableView
                  tasks={filteredTasks}
                  elements={elements}
                  onStatusUpdate={handleStatusUpdate}
                  onProgressUpdate={handleProgressUpdate}
                  onDateUpdate={handleDateUpdate}
                  onEditTask={(task) => setDrawerTask(task as TaskType)}
                  onDeleteTask={handleDeleteTask}
                  canEdit={isAdmin || isProjectManager || isCurrentUserLead || hasAssignedTasks}
                  canDelete={isAdmin || isProjectManager}
                />
              )}

              {viewType === 'calendar' && (
                <TaskCalendarView
                  tasks={filteredTasks}
                  elements={elements}
                  onStatusUpdate={handleStatusUpdate}
                  onProgressUpdate={handleProgressUpdate}
                  onDateUpdate={handleDateUpdate}
                  onEditTask={(task) => setDrawerTask(task as TaskType)}
                  canEdit={isAdmin || isProjectManager || isCurrentUserLead || hasAssignedTasks}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="gantt" className="space-y-4">
          <DepartmentGanttView
            departmentId={department.id}
            departmentName={department.name}
            tasks={tasks}
            onTasksUpdate={fetchTasksAndAnalytics}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DepartmentDocumentBrowser
            projectId={projectId!}
            departmentId={departmentId!}
            departmentName={department.name}
          />
        </TabsContent>

        {(isAdmin || isProjectManager || isCurrentUserLead) && (
          <TabsContent value="external-users" className="space-y-4">
            <ExternalUsersManager
              departmentId={departmentId!}
              projectId={projectId!}
              departmentName={department.name}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={drawerTask}
        open={!!drawerTask}
        onOpenChange={(open) => !open && setDrawerTask(null)}
        onTaskUpdated={fetchTasksAndAnalytics}
        canEdit={isAdmin || isProjectManager || isCurrentUserLead || (drawerTask?.assigned_users?.some(u => u.id === currentUserId) ?? false)}
      />

      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        onSuccess={fetchTasksAndAnalytics}
      />

      <EditElementDialog
        open={!!editingElement}
        onOpenChange={(open) => !open && setEditingElement(null)}
        element={editingElement}
        onSuccess={fetchTasksAndAnalytics}
      />

      {/* Delete Department Confirmation Dialog */}
      <AlertDialog open={deletingDepartment} onOpenChange={setDeletingDepartment}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this department? This action cannot be undone. All tasks and elements in this department will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteDepartment}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Department Dialog */}
      <EditDepartmentDialog
        department={editingDepartment}
        open={!!editingDepartment}
        onOpenChange={(open) => !open && setEditingDepartment(null)}
        onSuccess={fetchData}
      />
    </div>
  );
}
