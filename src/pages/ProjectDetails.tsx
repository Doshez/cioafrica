import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
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
  MessageSquare,
  BarChart3,
  Search,
  FileText,
  Users,
  Plus,
  Settings,
  CalendarDays,
  UserCircle,
  Upload,
  Target,
  Activity,
  Layers,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
}

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isProjectManager } = useUserRole();

  const [project, setProject] = useState<Project | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [ownerName, setOwnerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [messagingOpen, setMessagingOpen] = useState(false);
  const { unreadCount } = useUnreadMessages(projectId || null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('onboarding') === 'true') {
      setShowOnboarding(true);
      setActiveTab('team');
      navigate(`/projects/${projectId}`, { replace: true });
    }
  }, [location.search]);

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

      // Fetch owner name
      if (projectData.owner_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', projectData.owner_id)
          .maybeSingle();
        setOwnerName(ownerProfile?.full_name || ownerProfile?.email || 'Unknown');
      }

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

      // Fetch team members
      const { data: membersData } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);
      const memberIds = [...new Set([
        ...(membersData || []).map(m => m.user_id),
        ...(projectData.owner_id ? [projectData.owner_id] : [])
      ])];
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', memberIds);
        setTeamMembers(profiles || []);
      }
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

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  if (loading || !project) {
    return <ProjectLoadingScreen projectId={projectId} />;
  }

  const completedCount = tasks.filter(t => t.status === 'done').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const todoCount = tasks.filter(t => t.status === 'todo' || t.status === 'pending').length;
  const projectProgress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done');

  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-success/10 text-success border-success/20' },
    completed: { label: 'Completed', className: 'bg-primary/10 text-primary border-primary/20' },
    planning: { label: 'Planning', className: 'bg-warning/10 text-warning border-warning/20' },
    on_hold: { label: 'On Hold', className: 'bg-muted text-muted-foreground border-border' },
  };

  const currentStatus = statusConfig[project.status] || statusConfig['active'];

  const navItems = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'departments', label: 'Departments', icon: Building2, count: departments.length },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: unreadCount || undefined },
    { id: 'gantt', label: 'Gantt', icon: GanttChartSquare, action: () => navigate(`/projects/${projectId}/gantt`) },
    { id: 'docs', label: 'Documents', icon: FileText, action: () => navigate(`/projects/${projectId}/documents`) },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, action: () => navigate(`/projects/${projectId}/analytics`) },
    ...(isAdmin ? [{ id: 'reports', label: 'Reports', icon: FileText, action: () => navigate(`/projects/${projectId}/reports`) }] : []),
  ];

  return (
    <div className="space-y-0 max-w-7xl mx-auto">
      {/* ============ PROJECT HEADER CARD ============ */}
      <Card className="border-none shadow-[var(--shadow-md)] bg-card rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {/* Top accent bar */}
          <div className="h-1 w-full" style={{ background: 'var(--gradient-primary)' }} />
          
          <div className="p-5 sm:p-6">
            {/* Row 1: Back + Logo + Name + Status + Actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/projects')}
                  className="h-9 w-9 rounded-lg flex-shrink-0 hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                {project.logo_url ? (
                  <img src={project.logo_url} alt="" className="h-10 w-10 rounded-xl object-contain flex-shrink-0 ring-1 ring-border" />
                ) : (
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                    <Layers className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{project.name}</h1>
                    <Badge variant="outline" className={cn('text-[11px] font-medium flex-shrink-0 border', currentStatus.className)}>
                      {currentStatus.label}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{project.description}</p>
                  )}
                </div>
              </div>

              {(isAdmin || isProjectManager) && (
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <UpdateProjectLogoDialog projectId={projectId!} currentLogoUrl={project.logo_url} onLogoUpdated={fetchProjectData} />
                  <CreateDepartmentDialog projectId={projectId!} onDepartmentCreated={fetchProjectData} />
                  <CreateTaskDialog projectId={projectId} onTaskCreated={fetchProjectData} showTrigger={false} />
                  <ChatSettingsDialog projectId={projectId!} />
                </div>
              )}
            </div>

            {/* Row 2: Meta info */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 ml-[4.5rem] sm:ml-[4.75rem]">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>
                  {format(new Date(project.start_date), 'MMM d, yyyy')}
                  {project.end_date && ` — ${format(new Date(project.end_date), 'MMM d, yyyy')}`}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserCircle className="h-3.5 w-3.5" />
                <span>{ownerName}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ListTodo className="h-3.5 w-3.5" />
                <span>{tasks.length} tasks</span>
              </div>

              {/* Team Avatars */}
              {teamMembers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-2">
                    {teamMembers.slice(0, 5).map(member => (
                      <Tooltip key={member.id}>
                        <TooltipTrigger asChild>
                          <Avatar className="h-6 w-6 ring-2 ring-card">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {member.full_name || member.email}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {teamMembers.length > 5 && (
                      <Avatar className="h-6 w-6 ring-2 ring-card">
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-medium">
                          +{teamMembers.length - 5}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ NAVIGATION TABS ============ */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pt-4 pb-1">
        <div className="flex flex-wrap gap-1.5 px-1">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if ('action' in item && item.action) {
                    (item as any).action();
                  } else if (item.id === 'chat') {
                    setMessagingOpen(true);
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                {'count' in item && item.count !== undefined && (item.count as number) > 0 && (
                  <span className={cn(
                    'h-5 min-w-5 px-1.5 text-[10px] font-semibold rounded-full flex items-center justify-center',
                    item.id === 'chat'
                      ? isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-destructive text-destructive-foreground'
                      : isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/15 text-muted-foreground'
                  )}>
                    {item.count as number}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Separator className="mt-3" />
      </div>

      <MessagingCenter open={messagingOpen} onOpenChange={setMessagingOpen} projectId={projectId!} />

      {/* ============ OVERVIEW TAB ============ */}
      {activeTab === 'overview' && (
        <div className="space-y-6 pt-4">
          {/* Onboarding prompt */}
          {showOnboarding && (
            <Card className="border-primary/30 bg-primary/5 rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Add team members to your project</p>
                    <p className="text-xs text-muted-foreground">Invite users so you can assign tasks and collaborate.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setActiveTab('team'); setShowOnboarding(false); }}>
                    Add Users
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowOnboarding(false)}>
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gantt Chart CTA + Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Gantt CTA */}
            <button
              onClick={() => navigate(`/projects/${projectId}/gantt`)}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 hover:from-primary/10 hover:via-primary/15 hover:to-accent/10 transition-all duration-300 group shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <GanttChartSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">Open Gantt Chart</p>
                <p className="text-xs text-muted-foreground">View timeline, track progress & export reports</p>
              </div>
              <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all ml-auto flex-shrink-0" />
            </button>

            {/* Quick Actions */}
            {(isAdmin || isProjectManager) && (
              <div className="flex flex-wrap gap-2 items-center">
                <CreateTaskDialog projectId={projectId} onTaskCreated={fetchProjectData} showTrigger={true} />
                <CreateDepartmentDialog projectId={projectId!} onDepartmentCreated={fetchProjectData} />
                <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => setActiveTab('team')}>
                  <Users className="h-3.5 w-3.5" />
                  Invite User
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => navigate(`/projects/${projectId}/documents`)}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload Document
                </Button>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Progress */}
            <Card className="rounded-xl border shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Target className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</span>
                </div>
                <p className="text-3xl font-bold tracking-tight">{projectProgress}%</p>
                <p className="text-xs text-muted-foreground mt-1">Overall completion</p>
                <Progress value={projectProgress} className="h-2 mt-3 rounded-full" />
              </CardContent>
            </Card>

            {/* Departments */}
            <Card className="rounded-xl border shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Building2 className="h-4.5 w-4.5 text-accent" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Departments</span>
                </div>
                <p className="text-3xl font-bold tracking-tight">{departments.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Active departments</p>
                <div className="h-2 mt-3" />
              </CardContent>
            </Card>

            {/* Completed */}
            <Card className="rounded-xl border shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</span>
                </div>
                <p className="text-3xl font-bold tracking-tight text-success">{completedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">of {tasks.length} total tasks</p>
                <Progress value={tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0} className="h-2 mt-3 rounded-full [&>div]:bg-success" />
              </CardContent>
            </Card>

            {/* In Progress */}
            <Card className="rounded-xl border shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Activity className="h-4.5 w-4.5 text-warning" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">In Progress</span>
                </div>
                <p className="text-3xl font-bold tracking-tight text-warning">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Tasks running</p>
                <Progress value={tasks.length > 0 ? (inProgressCount / tasks.length) * 100 : 0} className="h-2 mt-3 rounded-full [&>div]:bg-warning" />
              </CardContent>
            </Card>
          </div>

          {/* Overdue Tasks Alert */}
          {overdueTasks.length > 0 && (
            <Card className="rounded-xl border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">{overdueTasks.length} Overdue Task{overdueTasks.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {overdueTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-destructive/5">
                      <span className="truncate text-foreground">{task.title}</span>
                      <span className="text-xs text-destructive flex-shrink-0 ml-2">
                        Due {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    </div>
                  ))}
                  {overdueTasks.length > 5 && (
                    <p className="text-xs text-destructive/70 pl-2">+{overdueTasks.length - 5} more overdue</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Department Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Departments</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('departments')} className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                View all
                <ArrowLeft className="h-3 w-3 rotate-180" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.slice(0, 6).map(dept => {
                const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
                const completion = analytics?.completion_percentage || 0;
                return (
                  <Card
                    key={dept.id}
                    className="rounded-xl border shadow-[var(--shadow-sm)] cursor-pointer hover:shadow-[var(--shadow-md)] transition-all duration-200 group hover:border-primary/30"
                    onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                            <Folder className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{dept.name}</h3>
                            <p className="text-xs text-muted-foreground">{analytics?.total_tasks || 0} tasks</p>
                          </div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Progress</span>
                          <span className="text-xs font-semibold">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-2 rounded-full" />
                      </div>

                      {/* Task Stats */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          <span>{analytics?.completed_tasks || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-warning" />
                          <span>{analytics?.in_progress_tasks || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ListTodo className="h-3.5 w-3.5" />
                          <span>{analytics?.todo_tasks || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============ DEPARTMENTS TAB ============ */}
      {activeTab === 'departments' && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card rounded-lg"
              />
            </div>
          </div>

          {getFilteredDepartments().length === 0 ? (
            <Card className="rounded-xl">
              <CardContent className="py-12 text-center">
                <Folder className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {isAdmin || isProjectManager ? 'No departments yet. Create one to get started.' : 'No departments available.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {getFilteredDepartments().map(dept => {
                const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
                const hasMyTasks = userHasTasksInDepartment(dept.id);
                const myTaskCount = getUserTaskCount(dept.id);
                const completion = analytics?.completion_percentage || 0;

                return (
                  <Card
                    key={dept.id}
                    className={cn(
                      "rounded-xl border shadow-[var(--shadow-sm)] cursor-pointer hover:shadow-[var(--shadow-md)] transition-all duration-200 group hover:border-primary/30",
                      hasMyTasks && !isAdmin && !isProjectManager && "border-primary/30"
                    )}
                    onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
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
                            <span className="font-semibold">{completion}%</span>
                          </div>
                          <Progress value={completion} className="h-2 rounded-full" />
                          <div className="flex items-center gap-4 pt-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              <span>{analytics.completed_tasks}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 text-warning" />
                              <span>{analytics.in_progress_tasks}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <ListTodo className="h-3.5 w-3.5" />
                              <span>{analytics.todo_tasks}</span>
                            </div>
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

      {/* ============ TEAM TAB ============ */}
      {activeTab === 'team' && (
        <div className="pt-4">
          <ProjectMembersCard projectId={projectId!} projectOwnerId={project.owner_id} />
        </div>
      )}
    </div>
  );
}
