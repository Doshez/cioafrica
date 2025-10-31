import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { DepartmentGanttView } from '@/components/DepartmentGanttView';
import { useUserRole } from '@/hooks/useUserRole';
import { ArrowLeft, Plus, Filter, Calendar, Clock, MoreVertical, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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

interface TaskWithProfile extends Task {
  assignee_name?: string;
  assignee_email?: string;
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
  const [analytics, setAnalytics] = useState<DepartmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (departmentId && projectId) {
      fetchData();
    }
  }, [departmentId, projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch department
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();

      if (deptError) throw deptError;
      setDepartment(deptData);

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      await fetchTasksAndAnalytics();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksAndAnalytics = async () => {
    try {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('assignee_department_id', departmentId)
        .order('start_date', { ascending: true });

      if (tasksError) throw tasksError;

      // Fetch assignee profiles for tasks that have assignees
      const tasksWithProfiles: TaskWithProfile[] = await Promise.all(
        (tasksData || []).map(async (task) => {
          if (task.assignee_user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', task.assignee_user_id)
              .maybeSingle();
            
            return {
              ...task,
              assignee_name: profileData?.full_name,
              assignee_email: profileData?.email,
            };
          }
          return task;
        })
      );

      setTasks(tasksWithProfiles);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50';
      case 'todo':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'todo':
        return 'To Do';
      default:
        return status;
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    // Optimistically update local state
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: newStatus,
              completed_at: newStatus === 'completed' ? new Date().toISOString() : null
            } 
          : task
      )
    );

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null 
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
    
    if (progress >= 100) {
      newStatus = 'completed';
      completedAt = new Date().toISOString();
    } else if (progress > 0 && progress < 100) {
      newStatus = 'in_progress';
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
        description: progress >= 100 ? 'Task completed!' : 'Progress updated successfully',
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
          <CreateTaskDialog
            projectId={projectId}
            departmentId={departmentId}
            onTaskCreated={fetchTasksAndAnalytics}
          />
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

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list">List View</TabsTrigger>
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

          {/* Task List */}
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const progress = task.progress_percentage ?? (task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0);
              return (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Title and Priority */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-semibold">{task.title}</h3>
                          <Badge variant={getPriorityColor(task.priority)} className="capitalize">
                            {task.priority}
                          </Badge>
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Assigned User */}
                        {task.assignee_name && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Assigned to:</span>
                            <span className="font-medium">{task.assignee_name}</span>
                          </div>
                        )}

                        {/* Status Control */}
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground">Status</span>
                          <Select 
                            value={task.status} 
                            onValueChange={(value) => handleStatusUpdate(task.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Progress Control */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={progress} className="h-2 flex-1" />
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={progress}
                              onChange={(e) => {
                                const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                handleProgressUpdate(task.id, value);
                              }}
                              className="w-20 h-8"
                            />
                          </div>
                        </div>

                        {/* Meta Information */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          {task.start_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Start: {new Date(task.start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.estimate_hours && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{task.estimate_hours}h estimated</span>
                            </div>
                          )}
                          {task.logged_hours !== undefined && task.logged_hours > 0 && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{task.logged_hours}h logged</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-background z-50">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Task</DropdownMenuItem>
                          <DropdownMenuItem>Add Comment</DropdownMenuItem>
                          <DropdownMenuItem>Attach File</DropdownMenuItem>
                          {(isAdmin || isProjectManager) && (
                            <DropdownMenuItem className="text-destructive">
                              Delete Task
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredTasks.length === 0 && (
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
          </div>
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
    </div>
  );
}
