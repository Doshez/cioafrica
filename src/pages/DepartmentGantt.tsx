import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { CreateElementDialog } from '@/components/CreateElementDialog';
import { DepartmentGanttView } from '@/components/DepartmentGanttView';
import { TasksByElementView } from '@/components/TasksByElementView';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { EditElementDialog } from '@/components/EditElementDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { ArrowLeft, Plus, Filter, Calendar, Clock, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const [department, setDepartment] = useState<Department | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [analytics, setAnalytics] = useState<DepartmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editingElement, setEditingElement] = useState<{ id: string; title: string; description?: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasAssignedTasks, setHasAssignedTasks] = useState(false);

  useEffect(() => {
    if (departmentId && projectId) {
      fetchCurrentUser();
      fetchData();
    }
  }, [departmentId, projectId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch department
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .maybeSingle();

      if (deptError) throw deptError;
      
      // Check if user has access to this department
      if (!deptData) {
        toast({
          title: 'Access Denied',
          description: 'You do not have access to this department. You can only view departments where you have assigned tasks.',
          variant: 'destructive',
        });
        navigate(`/projects/${projectId}`);
        return;
      }
      
      setDepartment(deptData);

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      
      if (!projectData) {
        toast({
          title: 'Error',
          description: 'Project not found',
          variant: 'destructive',
        });
        navigate('/projects');
        return;
      }
      
      setProject(projectData);

      await fetchTasksAndAnalytics();
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

  const fetchTasksAndAnalytics = async () => {
    try {
      // Fetch all elements for this department
      const { data: elementsData, error: elementsError } = await supabase
        .from('elements')
        .select('id, title, description')
        .eq('department_id', departmentId)
        .order('created_at', { ascending: true });

      if (elementsError) throw elementsError;
      setElements(elementsData || []);

      // Fetch tasks with element information
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          element:elements(id, title)
        `)
        .eq('project_id', projectId)
        .eq('assignee_department_id', departmentId)
        .order('start_date', { ascending: true });

      if (tasksError) throw tasksError;

      // Fetch task assignments (new multi-user support)
      const taskIds = tasksData?.map(task => task.id) || [];
      const { data: assignmentsData } = await supabase
        .from('task_assignments')
        .select('task_id, user_id')
        .in('task_id', taskIds);

      // Fetch all unique user profiles
      const uniqueUserIds = [...new Set(assignmentsData?.map(a => a.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uniqueUserIds);

      // Map assignments and profiles to tasks
      const tasksWithProfiles: TaskWithProfile[] = tasksData?.map(task => {
        const taskAssignments = assignmentsData?.filter(a => a.task_id === task.id) || [];
        const assignedUsers = taskAssignments.map(assignment => {
          const profile = profilesData?.find(p => p.id === assignment.user_id);
          return {
            id: assignment.user_id,
            name: profile?.full_name || 'Unknown',
            email: profile?.email,
          };
        });
        
        // Also keep legacy single assignee for backward compatibility
        const legacyProfile = task.assignee_user_id 
          ? profilesData?.find(p => p.id === task.assignee_user_id)
          : null;
        
        return {
          ...task,
          assigned_users: assignedUsers,
          assignee_name: legacyProfile?.full_name,
          assignee_email: legacyProfile?.email,
          element_id: (task.element as any)?.id,
          element_name: (task.element as any)?.title,
        };
      }) || [];

      setTasks(tasksWithProfiles);

      // Check if current user has any assigned tasks in this department
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !isAdmin && !isProjectManager) {
        const userHasTasks = tasksWithProfiles.some(task => task.assignee_user_id === user.id);
        setHasAssignedTasks(userHasTasks);
      } else {
        setHasAssignedTasks(true); // Admin/PM always have access
      }

      // Fetch analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('department_analytics')
        .select('*')
        .eq('department_id', departmentId)
        .single();

      if (analyticsError && analyticsError.code !== 'PGRST116') throw analyticsError;
      setAnalytics(analyticsData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    // Sync percentage with status
    let newPercentage = tasks.find(t => t.id === taskId)?.progress_percentage || 0;
    
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

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!department || !project) {
    return <div className="p-8">Department or project not found</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{department.name}</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
            {department.description && (
              <p className="text-sm text-muted-foreground mt-1">{department.description}</p>
            )}
          </div>
        </div>
        {(isAdmin || isProjectManager) && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
              <p className="text-3xl font-bold">{analytics?.total_tasks || 0}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">To Do</p>
              <p className="text-3xl font-bold text-gray-600">{analytics?.todo_tasks || 0}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">In Progress</p>
              <p className="text-3xl font-bold text-blue-600">{analytics?.in_progress_tasks || 0}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-3xl font-bold text-green-600">{analytics?.completed_tasks || 0}</p>
              <div className="space-y-1">
                <Progress value={Number(analytics?.completion_percentage || 0)} className="h-2" />
                <p className="text-xs text-muted-foreground">{Number(analytics?.completion_percentage || 0).toFixed(0)}% Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasAssignedTasks && !isAdmin && !isProjectManager && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              You are viewing this department in read-only mode. You can see the Gantt chart but cannot view or edit task details as you are not assigned to any tasks in this department.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={hasAssignedTasks || isAdmin || isProjectManager ? "list" : "gantt"} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list" disabled={!hasAssignedTasks && !isAdmin && !isProjectManager}>
            List View
          </TabsTrigger>
          <TabsTrigger value="gantt">Gantt Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tasks by Element Columns */}
          {elements.length > 0 || filteredTasks.length > 0 ? (
            <TasksByElementView
              tasks={filteredTasks}
              elements={elements}
              onStatusUpdate={handleStatusUpdate}
              onProgressUpdate={handleProgressUpdate}
              onEditTask={(task) => setEditingTask(task)}
              onEditElement={(id, name) => {
                const element = elements.find(e => e.id === id);
                if (element) {
                  setEditingElement({ id, title: name, description: element.description });
                }
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No tasks found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or create a new task</p>
                </div>
              </CardContent>
            </Card>
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
      </Tabs>

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
    </div>
  );
}
