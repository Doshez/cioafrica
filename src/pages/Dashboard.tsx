import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, CheckCircle2, AlertCircle, Clock, Loader2, Bell, ArrowRight, FolderKanban, CalendarDays, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Progress } from '@/components/ui/progress';
import { isTaskDoneStatus } from '@/lib/taskStatus';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';

interface DashboardStats {
  activeProjects: number;
  completedTasks: number;
  overdueTasks: number;
  totalTasks: number;
}

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  project_name: string;
  project_id: string;
}

interface ProjectWithProgress {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  tasks: {
    total: number;
    completed: number;
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, isProjectManager } = useUserRole();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalTasks: 0,
  });
  const [recentProjects, setRecentProjects] = useState<ProjectWithProgress[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);

  useEffect(() => {
    if (user && (isAdmin !== undefined && isProjectManager !== undefined)) {
      fetchDashboardData();
    }
  }, [user, isAdmin, isProjectManager]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      let projectsQuery = supabase
        .from('projects')
        .select('id, name, description, status')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        const [memberProjectsRes, ownedProjectsRes] = await Promise.all([
          supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user?.id),
          supabase
            .from('projects')
            .select('id')
            .eq('owner_id', user?.id),
        ]);

        if (memberProjectsRes.error) throw memberProjectsRes.error;
        if (ownedProjectsRes.error) throw ownedProjectsRes.error;

        const memberIds = (memberProjectsRes.data || []).map(p => p.project_id);
        const ownedIds = (ownedProjectsRes.data || []).map(p => p.id);
        const visibleProjectIds = [...new Set([...memberIds, ...ownedIds])];

        if (visibleProjectIds.length > 0) {
          projectsQuery = projectsQuery.in('id', visibleProjectIds);
        } else {
          setStats({ activeProjects: 0, completedTasks: 0, overdueTasks: 0, totalTasks: 0 });
          setRecentProjects([]);
          setOverdueTasks([]);
          setLoading(false);
          return;
        }
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError) throw projectsError;

      const projectIds = (projects || []).map(p => p.id);
      const activeProjects = projects?.filter(p => p.status === 'active').length || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (projectIds.length === 0) {
        setStats({ activeProjects, completedTasks: 0, overdueTasks: 0, totalTasks: 0 });
        setRecentProjects([]);
        setOverdueTasks([]);
        setLoading(false);
        return;
      }

      const recent = (projects || []).slice(0, 4);
      const recentProjectIds = recent.map(p => p.id);

      // Build overdue query - non-admin users only see their assigned overdue tasks
      let overdueQuery = supabase
        .from('tasks')
        .select(`id, title, due_date, project_id, projects (name)`, { count: 'exact' })
        .in('project_id', projectIds)
        .not('due_date', 'is', null)
        .lt('due_date', today.toISOString())
        .or('status.is.null,status.not.in.(done,completed,complete)')
        .order('due_date', { ascending: true })
        .limit(50);

      if (!isAdmin && !isProjectManager) {
        overdueQuery = overdueQuery.eq('assignee_user_id', user?.id);
      }

      const [totalRes, completedRes, overdueRes, progressTasksRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .in('status', ['done', 'completed', 'complete', 'Done', 'Completed', 'DONE', 'COMPLETED']),
        overdueQuery,
        recentProjectIds.length > 0
          ? supabase.from('tasks').select('id, status, project_id').in('project_id', recentProjectIds)
          : (Promise.resolve({ data: [] as any[] }) as any),
      ]);

      if (totalRes.error) throw totalRes.error;
      if (completedRes.error) throw completedRes.error;
      if (overdueRes.error) throw overdueRes.error;
      if (progressTasksRes.error) throw progressTasksRes.error;

      const totalTasks = totalRes.count || 0;
      const completedTasks = completedRes.count || 0;
      const overdueTasksCount = overdueRes.count || 0;

      const overdueTasksList = overdueRes.data || [];
      setOverdueTasks(
        overdueTasksList.map((t: any) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          project_id: t.project_id,
          project_name: (t.projects as any)?.name || 'Unknown Project',
        }))
      );

      const progressTasks = (progressTasksRes.data || []) as any[];
      const projectsWithProgress = recent.map(project => {
        const projectTasks = progressTasks.filter(t => t.project_id === project.id);
        const completedProjectTasks = projectTasks.filter(t => isTaskDoneStatus(t.status));
        const progress = projectTasks.length > 0
          ? Math.round((completedProjectTasks.length / projectTasks.length) * 100)
          : 0;
        return {
          ...project,
          progress,
          tasks: { total: projectTasks.length, completed: completedProjectTasks.length },
        };
      });

      setStats({ activeProjects, completedTasks, overdueTasks: overdueTasksCount, totalTasks });
      setRecentProjects(projectsWithProgress);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  const firstName = (user?.user_metadata?.full_name || user?.email || 'there').split(' ')[0];
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Hero Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/10 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary mb-1">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{firstName} 👋</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              {stats.overdueTasks > 0 
                ? `You have ${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? 's' : ''} that need${stats.overdueTasks === 1 ? 's' : ''} attention.`
                : 'All caught up! Here\'s your project overview.'}
            </p>
          </div>
          <Button className="gap-2 shadow-sm" onClick={() => navigate('/projects')}>
            <FolderKanban className="h-4 w-4" />
            View Projects
          </Button>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdueTasks.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 p-4 border-b border-destructive/10">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Bell className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-sm font-semibold text-destructive flex-1">
                {overdueTasks.length} Overdue Task{overdueTasks.length > 1 ? 's' : ''}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-destructive hover:text-destructive" 
                onClick={() => navigate('/my-tasks?filter=overdue')}
              >
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="divide-y divide-destructive/10">
              {overdueTasks.slice(0, 3).map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-destructive/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${task.project_id}`)}
                >
                  <AlertCircle className="h-3.5 w-3.5 text-destructive/60 flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{task.title}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{task.project_name}</span>
                  <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive flex-shrink-0">
                    {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="group transition-all duration-200 hover:shadow-lg hover:border-primary/20">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FolderKanban className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground mt-1">Active projects</p>
          </CardContent>
        </Card>

        <Card className="group transition-all duration-200 hover:shadow-lg hover:border-success/20">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</span>
              <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">of {stats.totalTasks} tasks</p>
          </CardContent>
        </Card>

        <Card className={`group transition-all duration-200 hover:shadow-lg ${stats.overdueTasks > 0 ? 'hover:border-destructive/20' : 'hover:border-success/20'}`}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue</span>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${stats.overdueTasks > 0 ? 'bg-destructive/10 group-hover:bg-destructive/20' : 'bg-success/10 group-hover:bg-success/20'}`}>
                <AlertCircle className={`h-4 w-4 ${stats.overdueTasks > 0 ? 'text-destructive' : 'text-success'}`} />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{stats.overdueTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.overdueTasks > 0 ? 'Need attention' : 'All on track'}</p>
          </CardContent>
        </Card>

        <Card className="group transition-all duration-200 hover:shadow-lg hover:border-accent/20">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completion</span>
              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <TrendingUp className="h-4 w-4 text-accent" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{completionRate}%</div>
            <Progress value={completionRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Projects</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recentProjects.length === 0 ? (
            <Card className="col-span-full border-dashed">
              <CardContent className="py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <FolderKanban className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Get started by viewing or creating a project</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate('/projects')}>
                  View Projects
                </Button>
              </CardContent>
            </Card>
          ) : (
            recentProjects.map((project) => (
              <Card 
                key={project.id} 
                className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors pr-2 leading-tight">
                      {project.name}
                    </h3>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] flex-shrink-0 capitalize ${
                        project.status === 'active' 
                          ? 'border-success/30 text-success bg-success/5' 
                          : 'border-muted text-muted-foreground'
                      }`}
                    >
                      {project.status}
                    </Badge>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{project.tasks.completed}/{project.tasks.total} tasks</span>
                      <span className="font-semibold text-foreground">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions for non-admin users */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card 
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 group"
          onClick={() => navigate('/my-tasks')}
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold group-hover:text-primary transition-colors">My Tasks</p>
              <p className="text-xs text-muted-foreground mt-0.5">View and manage your assigned tasks</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto flex-shrink-0 group-hover:text-primary transition-colors" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 group"
          onClick={() => navigate('/analytics')}
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold group-hover:text-primary transition-colors">Analytics</p>
              <p className="text-xs text-muted-foreground mt-0.5">View detailed reports and insights</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto flex-shrink-0 group-hover:text-primary transition-colors" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 group"
          onClick={() => navigate('/projects')}
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0 group-hover:bg-success/20 transition-colors">
              <FolderKanban className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold group-hover:text-primary transition-colors">Projects</p>
              <p className="text-xs text-muted-foreground mt-0.5">Browse all your projects</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto flex-shrink-0 group-hover:text-primary transition-colors" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
