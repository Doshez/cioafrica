import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, CheckCircle2, AlertCircle, Clock, Loader2, Bell, ArrowRight, FolderKanban } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Progress } from '@/components/ui/progress';
import { isTaskDoneStatus } from '@/lib/taskStatus';
import { Badge } from '@/components/ui/badge';

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
        supabase
          .from('tasks')
          .select(`id, title, due_date, project_id, projects (name)`, { count: 'exact' })
          .in('project_id', projectIds)
          .not('due_date', 'is', null)
          .lt('due_date', today.toISOString())
          .or('status.is.null,status.not.in.(done,completed,complete)')
          .order('due_date', { ascending: true })
          .limit(50),
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

  const statsCards = [
    {
      title: 'Active Projects',
      value: stats.activeProjects,
      icon: FolderKanban,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Completed',
      value: stats.completedTasks,
      subtitle: `of ${stats.totalTasks} tasks`,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Overdue',
      value: stats.overdueTasks,
      subtitle: stats.overdueTasks > 0 ? 'Need attention' : 'All on track',
      icon: AlertCircle,
      color: stats.overdueTasks > 0 ? 'text-destructive' : 'text-success',
      bgColor: stats.overdueTasks > 0 ? 'bg-destructive/10' : 'bg-success/10',
    },
    {
      title: 'Completion Rate',
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      isProgress: true,
      progressValue: completionRate,
    },
  ];

  const firstName = (user?.user_metadata?.full_name || user?.email || 'there').split(' ')[0];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening across your projects
          </p>
        </div>
        {(isAdmin || isProjectManager) && (
          <Button size="sm" className="gap-2 shadow-sm" onClick={() => navigate('/projects')}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Overdue Alert */}
      {stats.overdueTasks > 0 && (
        <Card 
          className="border-destructive/30 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
          onClick={() => navigate('/my-tasks?filter=overdue')}
        >
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">
                {stats.overdueTasks} overdue task{stats.overdueTasks > 1 ? 's' : ''} need attention
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {overdueTasks.slice(0, 2).map(t => t.title).join(', ')}
                {overdueTasks.length > 2 && ` +${overdueTasks.length - 2} more`}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="transition-smooth hover:shadow-md">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.title}
                </span>
                <div className={`h-8 w-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.isProgress && (
                <Progress value={stat.progressValue} className="h-1.5 mt-2" />
              )}
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Projects</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-xs gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recentProjects.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
                {(isAdmin || isProjectManager) && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/projects')}>
                    Create your first project
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            recentProjects.map((project) => (
              <Card 
                key={project.id} 
                className="cursor-pointer transition-smooth hover:shadow-md group"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors pr-2">
                      {project.name}
                    </h3>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] flex-shrink-0 ${
                        project.status === 'active' 
                          ? 'border-success/30 text-success bg-success/5' 
                          : 'border-muted text-muted-foreground'
                      }`}
                    >
                      {project.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{project.tasks.completed}/{project.tasks.total} tasks</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
