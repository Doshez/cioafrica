import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateDepartmentDialog } from '@/components/CreateDepartmentDialog';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { ProjectMembersCard } from '@/components/ProjectMembersCard';
import { useUserRole } from '@/hooks/useUserRole';
import { UpdateProjectLogoDialog } from '@/components/UpdateProjectLogoDialog';
import { ProjectLoadingScreen } from '@/components/ProjectLoadingScreen';
import { MessagingCenter } from '@/components/MessagingCenter';
import { ChatSettingsDialog } from '@/components/ChatSettingsDialog';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import {
  ArrowLeft, 
  Folder, 
  CheckCircle2, 
  Clock, 
  ListTodo,
  TrendingUp,
  ExternalLink,
  GanttChartSquare,
  Grid3x3,
  List,
  Filter,
  User,
  MessageSquare,
  BarChart3,
  Search,
  LayoutGrid,
  Table,
  FileText,
  Users,
  Plus,
  Settings
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  owner_id: string;
  logo_url?: string | null;
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
  assignee_user_id?: string;
  assigned_user_ids?: string[];
}

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isProjectManager } = useUserRole();
  
  const [project, setProject] = useState<Project | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [messagingOpen, setMessagingOpen] = useState(false);
  const { unreadCount } = useUnreadMessages(projectId || null);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!projectData) {
        toast({ title: 'Error', description: 'Project not found or you do not have access', variant: 'destructive' });
        navigate('/projects');
        return;
      }
      setProject(projectData);

      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      if (deptError) throw deptError;
      setDepartments(deptData || []);

      const { data: analyticsData, error: analyticsError } = await supabase
        .from('department_analytics')
        .select('*')
        .eq('project_id', projectId);
      if (analyticsError) throw analyticsError;
      setDepartmentAnalytics(analyticsData || []);

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (tasksError) throw tasksError;

      const taskIds = (tasksData || []).map(t => t.id);
      let taskAssignmentsMap: Record<string, string[]> = {};
      if (taskIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('task_assignments')
          .select('task_id, user_id')
          .in('task_id', taskIds);
        (assignmentsData || []).forEach(a => {
          if (!taskAssignmentsMap[a.task_id]) taskAssignmentsMap[a.task_id] = [];
          taskAssignmentsMap[a.task_id].push(a.user_id);
        });
      }
      const tasksWithAssignments = (tasksData || []).map(task => ({
        ...task,
        assigned_user_ids: taskAssignmentsMap[task.id] || []
      }));
      setTasks(tasksWithAssignments);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentTasks = (departmentId: string) => {
    return tasks.filter(task => task.assignee_department_id === departmentId);
  };

  const userHasTasksInDepartment = (departmentId: string) => {
    if (isAdmin || isProjectManager) return true;
    return tasks.some(task => 
      task.assignee_department_id === departmentId && 
      (task.assignee_user_id === user?.id || task.assigned_user_ids?.includes(user?.id || ''))
    );
  };

  const getUserTaskCount = (departmentId: string) => {
    return tasks.filter(task => 
      task.assignee_department_id === departmentId && 
      (task.assignee_user_id === user?.id || task.assigned_user_ids?.includes(user?.id || ''))
    ).length;
  };

  const getFilteredDepartments = () => {
    let filtered = [...departments];
    if (searchQuery.trim()) {
      filtered = filtered.filter(dept => 
        dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered.sort((a, b) => {
      const aHasTasks = userHasTasksInDepartment(a.id);
      const bHasTasks = userHasTasksInDepartment(b.id);
      if (aHasTasks && !bHasTasks) return -1;
      if (!aHasTasks && bHasTasks) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  if (loading || !project) {
    return <ProjectLoadingScreen projectId={projectId} />;
  }

  const completedCount = tasks.filter(t => t.status === 'done').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const projectProgress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'departments', label: 'Departments', icon: Folder, count: departments.length },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: unreadCount || undefined },
  ];

  const quickActions = [
    { label: 'Gantt', icon: GanttChartSquare, onClick: () => navigate(`/projects/${projectId}/gantt`) },
    { label: 'Docs', icon: FileText, onClick: () => navigate(`/projects/${projectId}/documents`) },
    { label: 'Analytics', icon: BarChart3, onClick: () => navigate(`/projects/${projectId}/analytics`) },
    ...(isAdmin ? [{ label: 'Reports', icon: FileText, onClick: () => navigate(`/projects/${projectId}/reports`) }] : []),
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Project Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="mt-1 flex-shrink-0 h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            {project.logo_url && (
              <img src={project.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
            )}
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <Badge variant="outline" className={`text-xs flex-shrink-0 ${
              project.status === 'active' ? 'border-success/30 text-success bg-success/5' : 'border-border text-muted-foreground'
            }`}>
              {project.status}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground ml-0 line-clamp-1">{project.description}</p>
          )}
        </div>
        {(isAdmin || isProjectManager) && (
          <div className="flex gap-2 flex-shrink-0">
            <UpdateProjectLogoDialog projectId={projectId!} currentLogoUrl={project.logo_url} onLogoUpdated={fetchProjectData} />
            <CreateDepartmentDialog projectId={projectId!} onDepartmentCreated={fetchProjectData} />
            <CreateTaskDialog projectId={projectId} onTaskCreated={fetchProjectData} showTrigger={false} />
            {(isAdmin || isProjectManager) && <ChatSettingsDialog projectId={projectId!} />}
          </div>
        )}
      </div>

      {/* Quick Actions Bar */}
      <div className="flex gap-2 flex-wrap">
        {quickActions.map(action => (
          <Button key={action.label} variant="outline" size="sm" onClick={action.onClick} className="gap-1.5 text-xs">
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'chat') {
                setMessagingOpen(true);
              } else {
                setActiveTab(item.id);
              }
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === item.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <Badge variant={item.id === 'chat' ? 'destructive' : 'secondary'} className="h-5 min-w-5 px-1.5 text-[10px]">
                {item.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <MessagingCenter open={messagingOpen} onOpenChange={setMessagingOpen} projectId={projectId!} />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Progress</p>
                <div className="text-2xl font-bold">{projectProgress}%</div>
                <Progress value={projectProgress} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Departments</p>
                <div className="text-2xl font-bold">{departments.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Completed</p>
                <div className="text-2xl font-bold text-success">{completedCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">of {tasks.length} tasks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">In Progress</p>
                <div className="text-2xl font-bold text-primary">{inProgressCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Departments Quick View */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Departments</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('departments')} className="text-xs gap-1">
                View all <ArrowLeft className="h-3 w-3 rotate-180" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {departments.slice(0, 6).map(dept => {
                const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
                return (
                  <Card 
                    key={dept.id} 
                    className="cursor-pointer transition-smooth hover:shadow-md group"
                    onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Folder className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">{dept.name}</span>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" /> {analytics?.completed_tasks || 0}
                        </span>
                        <span className="flex items-center gap-1 text-primary">
                          <Clock className="h-3 w-3" /> {analytics?.in_progress_tasks || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <ListTodo className="h-3 w-3" /> {analytics?.todo_tasks || 0}
                        </span>
                        <span className="ml-auto font-medium text-foreground">{analytics?.completion_percentage || 0}%</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
          </div>

          {getFilteredDepartments().length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Folder className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {isAdmin || isProjectManager ? 'No departments yet. Create one to get started.' : 'No departments available.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {getFilteredDepartments().map(dept => {
                const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
                const hasMyTasks = userHasTasksInDepartment(dept.id);
                const myTaskCount = getUserTaskCount(dept.id);

                return (
                  <Card 
                    key={dept.id}
                    className={cn(
                      "cursor-pointer transition-smooth hover:shadow-md group",
                      hasMyTasks && !isAdmin && !isProjectManager && "border-primary/30"
                    )}
                    onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Folder className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{dept.name}</h3>
                            {dept.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{dept.description}</p>
                            )}
                          </div>
                        </div>
                        {hasMyTasks && !isAdmin && !isProjectManager && (
                          <Badge variant="default" className="text-[10px] flex-shrink-0">{myTaskCount}</Badge>
                        )}
                      </div>
                      
                      {analytics && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{analytics.total_tasks || 0} tasks</span>
                            <span className="font-medium">{analytics.completion_percentage || 0}%</span>
                          </div>
                          <Progress value={analytics.completion_percentage || 0} className="h-1.5" />
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle2 className="h-3 w-3" /> {analytics.completed_tasks}
                            </span>
                            <span className="flex items-center gap-1 text-primary">
                              <Clock className="h-3 w-3" /> {analytics.in_progress_tasks}
                            </span>
                            <span className="flex items-center gap-1">
                              <ListTodo className="h-3 w-3" /> {analytics.todo_tasks}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <ProjectMembersCard projectId={projectId!} projectOwnerId={project.owner_id} />
      )}
    </div>
  );
}
