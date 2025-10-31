import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateDepartmentDialog } from '@/components/CreateDepartmentDialog';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  ArrowLeft, 
  Folder, 
  CheckCircle2, 
  Clock, 
  ListTodo,
  Calendar,
  TrendingUp,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
}

interface DepartmentAnalytics {
  department_id: string;
  department_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
  earliest_start_date: string;
  latest_due_date: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
}

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isProjectManager } = useUserRole();
  
  const [project, setProject] = useState<Project | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('project_id', projectId)
        .order('name');

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch department analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('department_analytics')
        .select('*')
        .eq('project_id', projectId);

      if (analyticsError) throw analyticsError;
      setDepartmentAnalytics(analyticsData || []);

      // Fetch all tasks for this project
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'todo':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
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

  const getDepartmentTasks = (departmentId: string) => {
    return tasks.filter(task => task.assignee_department_id === departmentId);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!project) {
    return <div className="p-8">Project not found</div>;
  }

  const projectProgress = tasks.length > 0 
    ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
    : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}/gantt`)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            View Gantt Chart
          </Button>
          {(isAdmin || isProjectManager) && (
            <>
              <CreateDepartmentDialog 
                projectId={projectId!} 
                onDepartmentCreated={fetchProjectData}
              />
              <CreateTaskDialog 
                projectId={projectId}
                onTaskCreated={fetchProjectData}
              />
            </>
          )}
        </div>
      </div>

      {/* Project Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Project Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Completion</span>
              <span className="font-semibold">{projectProgress}%</span>
            </div>
            <Progress value={projectProgress} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Departments</p>
              <p className="text-2xl font-bold">{departments.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold">{tasks.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {tasks.filter(t => t.status === 'completed').length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">
                {tasks.filter(t => t.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Departments and Analytics */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Departments</h2>
        {departments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No departments yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {departments.map((dept) => {
              const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
              const deptTasks = getDepartmentTasks(dept.id);

              return (
                <Card key={dept.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Folder className="h-5 w-5" />
                          {dept.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Task
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analytics && (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Completion</span>
                            <span className="font-semibold">{analytics.completion_percentage || 0}%</span>
                          </div>
                          <Progress value={analytics.completion_percentage || 0} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="space-y-1">
                            <CheckCircle2 className="h-4 w-4 mx-auto text-green-600" />
                            <p className="text-xs text-muted-foreground">Completed</p>
                            <p className="font-semibold">{analytics.completed_tasks}</p>
                          </div>
                          <div className="space-y-1">
                            <Clock className="h-4 w-4 mx-auto text-blue-600" />
                            <p className="text-xs text-muted-foreground">In Progress</p>
                            <p className="font-semibold">{analytics.in_progress_tasks}</p>
                          </div>
                          <div className="space-y-1">
                            <ListTodo className="h-4 w-4 mx-auto text-gray-600" />
                            <p className="text-xs text-muted-foreground">To Do</p>
                            <p className="font-semibold">{analytics.todo_tasks}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
